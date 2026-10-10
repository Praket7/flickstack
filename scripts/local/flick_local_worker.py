#!/usr/bin/env python3
import argparse,base64,json,math,os,subprocess,tempfile,threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path


def load_config(path):
    return json.loads(Path(path).read_text())

def nearest_8n1(frames):
    return max(9, int(round((frames-1)/8))*8+1)

def nearest_4n1(frames):
    return max(5, int(round((frames-1)/4))*4+1)

def resolution_dims(value, backend):
    if isinstance(value,str) and 'x' in value:
        a,b=value.lower().split('x',1)
        if a.isdigit() and b.isdigit(): return int(a),int(b)
    if backend.startswith('ltx'):
        return (1216,704) if value in (None,'720p') else (832,480)
    return (1280,704) if value in (None,'720p') else (832,480)

def safe_seed(seed, offset=0):
    try: return int(seed)+offset
    except: return 42+offset

def decode_inputs(inputs, job):
    rows=[]
    for i,item in enumerate(inputs or []):
        role=item.get('role','input')
        media=item.get('mediaType','application/octet-stream')
        ext='.png' if 'png' in media else '.jpg' if 'jpeg' in media or 'jpg' in media else '.mp4' if 'video' in media else '.bin'
        p=Path(job)/f'{i:02d}-{role}{ext}'
        p.write_bytes(base64.b64decode(item['dataBase64']))
        rows.append((role,p))
    return rows

def run_ltx(cfg,payload,job,outfile,seed):
    repo=Path(cfg['repoDir']); py=cfg['python']; controls=payload.get('controls') or {}; inputs=decode_inputs(payload.get('inputs'),job)
    width,height=resolution_dims(controls.get('resolution'),cfg['backend']); duration=float(controls.get('durationSeconds') or 4.0); frames=nearest_8n1(duration*30)
    conditioned=[]; starts=[]
    first=next((p for role,p in inputs if role=='first-frame'),None)
    last=next((p for role,p in inputs if role=='last-frame'),None)
    refs=[p for role,p in inputs if role=='reference']
    if first: conditioned.append(str(first)); starts.append('0')
    if last: conditioned.append(str(last)); starts.append(str(frames-1))
    for idx,p in enumerate(refs[:2]):
        conditioned.append(str(p)); starts.append(str(min(frames-1, int((idx+1)*frames/(len(refs[:2])+1)))))
    config_name='ltxv-13b-0.9.8-distilled.yaml' if cfg['backend']=='ltx-13b' else 'ltxv-2b-0.9.8-distilled.yaml'
    cmd=[py,'inference.py','--prompt',payload.get('prompt') or 'Cinematic product motion','--height',str(height),'--width',str(width),'--num_frames',str(frames),'--seed',str(seed),'--pipeline_config',str(repo/'configs'/config_name),'--output_path',str(outfile)]
    if conditioned:
        cmd += ['--conditioning_media_paths',*conditioned,'--conditioning_start_frames',*starts]
    subprocess.run(cmd,cwd=repo,check=True)

def run_wan(cfg,payload,job,outfile,seed):
    repo=Path(cfg['repoDir']); py=cfg['python']; controls=payload.get('controls') or {}; inputs=decode_inputs(payload.get('inputs'),job)
    first=next((p for role,p in inputs if role=='first-frame'),None)
    width,height=resolution_dims(controls.get('resolution'),cfg['backend']); size=f'{width}*{height}'; duration=float(controls.get('durationSeconds') or 4.0); frames=nearest_4n1(duration*24)
    cmd=[py,'generate.py','--task','ti2v-5B','--size',size,'--ckpt_dir',cfg['modelDir'],'--offload_model','True','--convert_model_dtype','--t5_cpu','--prompt',payload.get('prompt') or 'Cinematic product motion','--frame_num',str(frames),'--base_seed',str(seed),'--save_file',str(outfile)]
    if first: cmd += ['--image',str(first)]
    subprocess.run(cmd,cwd=repo,check=True)

def generate(cfg,payload):
    count=max(1,min(4,int((payload.get('controls') or {}).get('candidateCount') or 1))); outputs=[]
    with tempfile.TemporaryDirectory(prefix='flick-local-') as job:
        for i in range(count):
            out=Path(job)/f'candidate-{i:02d}.mp4'; seed=safe_seed(payload.get('seed'),i)
            if cfg['backend'].startswith('ltx-'): run_ltx(cfg,payload,job,out,seed)
            elif cfg['backend']=='wan22-ti2v5b': run_wan(cfg,payload,job,out,seed)
            else: raise RuntimeError('Configured backend is deterministic-only and cannot synthesize video')
            if not out.exists(): raise RuntimeError(f'backend did not produce {out}')
            outputs.append({'videoBase64':base64.b64encode(out.read_bytes()).decode('ascii'),'mediaType':'video/mp4','seed':seed})
    return {'model':cfg['backend'],'outputs':outputs,'metadata':{'local':True,'backend':cfg['backend']}}

def capabilities(cfg):
    if cfg['backend'].startswith('ltx-'):
        return {'supportsFirstFrame':True,'supportsLastFrame':True,'maxReferenceImages':2,'supportsNegativePrompt':False,'supportsSeed':True,'minDurationSeconds':1,'maxDurationSeconds':8.5,'supportedResolutions':['480p','720p'],'supportedAspectRatios':['16:9','9:16','1:1'],'supportsCameraControl':False,'supportsMotionMasks':False,'supportsExtension':True,'supportsNativeAudio':False}
    if cfg['backend']=='wan22-ti2v5b':
        return {'supportsFirstFrame':True,'supportsLastFrame':False,'maxReferenceImages':0,'supportsNegativePrompt':False,'supportsSeed':True,'minDurationSeconds':1,'maxDurationSeconds':8.5,'supportedResolutions':['480p','720p'],'supportedAspectRatios':['16:9','9:16'],'supportsCameraControl':False,'supportsMotionMasks':False,'supportsExtension':False,'supportsNativeAudio':False}
    return {'supportsFirstFrame':False,'supportsLastFrame':False,'maxReferenceImages':0,'supportsNegativePrompt':False,'supportsSeed':False,'supportsCameraControl':False,'supportsMotionMasks':False,'supportsExtension':False,'supportsNativeAudio':False}

class Handler(BaseHTTPRequestHandler):
    config=None
    def send_json(self,code,obj):
        raw=json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type','application/json'); self.send_header('content-length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/health': return self.send_json(200,{'ok':True,'backend':self.config['backend']})
        if self.path=='/capabilities': return self.send_json(200,capabilities(self.config))
        return self.send_json(404,{'error':'not found'})
    def do_POST(self):
        if self.path!='/v1/generate': return self.send_json(404,{'error':'not found'})
        try:
            length=int(self.headers.get('content-length','0')); payload=json.loads(self.rfile.read(length)); return self.send_json(200,generate(self.config,payload))
        except subprocess.CalledProcessError as e: return self.send_json(500,{'error':f'local backend failed with exit code {e.returncode}'})
        except Exception as e: return self.send_json(500,{'error':str(e)})
    def log_message(self,fmt,*args):
        print('[flick-local]',fmt%args)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--config',required=True); p.add_argument('--host',default='127.0.0.1'); p.add_argument('--port',type=int,default=7861); a=p.parse_args(); cfg=load_config(a.config); Handler.config=cfg
    print(f"FlickStack local worker: {cfg['backend']} on http://{a.host}:{a.port}")
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
if __name__=='__main__': main()
