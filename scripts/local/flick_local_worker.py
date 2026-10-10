#!/usr/bin/env python3
import argparse,base64,json,math,os,subprocess,tempfile
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
        role=item.get('role','input'); media=item.get('mediaType','application/octet-stream')
        ext='.png' if 'png' in media else '.jpg' if 'jpeg' in media or 'jpg' in media else '.mp4' if 'video' in media else '.bin'
        p=Path(job)/f'{i:02d}-{role}{ext}'; p.write_bytes(base64.b64decode(item['dataBase64'])); rows.append((role,p))
    return rows

def run_ltx(cfg,payload,job,outfile,seed):
    repo=Path(cfg['repoDir']); py=cfg['python']; controls=payload.get('controls') or {}; inputs=decode_inputs(payload.get('inputs'),job)
    width,height=resolution_dims(controls.get('resolution'),cfg['backend']); duration=float(controls.get('durationSeconds') or 4.0); frames=nearest_8n1(duration*30)
    conditioned=[]; starts=[]; first=next((p for role,p in inputs if role=='first-frame'),None); last=next((p for role,p in inputs if role=='last-frame'),None); refs=[p for role,p in inputs if role=='reference']
    if first: conditioned.append(str(first)); starts.append('0')
    if last: conditioned.append(str(last)); starts.append(str(frames-1))
    for idx,p in enumerate(refs[:2]): conditioned.append(str(p)); starts.append(str(min(frames-1,int((idx+1)*frames/(len(refs[:2])+1)))))
    config_name='ltxv-13b-0.9.8-distilled.yaml' if cfg['backend']=='ltx-13b' else 'ltxv-2b-0.9.8-distilled.yaml'
    cmd=[py,'inference.py','--prompt',payload.get('prompt') or 'Cinematic product motion','--height',str(height),'--width',str(width),'--num_frames',str(frames),'--seed',str(seed),'--pipeline_config',str(repo/'configs'/config_name),'--output_path',str(outfile)]
    if conditioned: cmd += ['--conditioning_media_paths',*conditioned,'--conditioning_start_frames',*starts]
    subprocess.run(cmd,cwd=repo,check=True)

def run_wan(cfg,payload,job,outfile,seed):
    repo=Path(cfg['repoDir']); py=cfg['python']; controls=payload.get('controls') or {}; inputs=decode_inputs(payload.get('inputs'),job); first=next((p for role,p in inputs if role=='first-frame'),None)
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

# ---------- Local product/brand analysis ----------
def _vision_imports():
    import cv2,numpy as np
    return cv2,np

def _decode_image(data):
    cv2,np=_vision_imports(); arr=np.frombuffer(base64.b64decode(data),dtype=np.uint8); im=cv2.imdecode(arr,cv2.IMREAD_COLOR)
    if im is None: raise RuntimeError('could not decode reference image')
    return im

def _sample_candidate(candidate):
    cv2,np=_vision_imports(); raw=base64.b64decode(candidate['dataBase64']); media=candidate.get('mediaType','')
    if media.startswith('image/'):
        arr=np.frombuffer(raw,dtype=np.uint8); im=cv2.imdecode(arr,cv2.IMREAD_COLOR); return [im] if im is not None else []
    with tempfile.NamedTemporaryFile(suffix='.mp4',delete=False) as f: f.write(raw); path=f.name
    try:
        cap=cv2.VideoCapture(path); count=max(1,int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1)); indices=sorted(set(int(x) for x in np.linspace(0,max(0,count-1),5))); frames=[]
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES,idx); ok,frame=cap.read();
            if ok and frame is not None: frames.append(frame)
        cap.release(); return frames
    finally:
        try: os.unlink(path)
        except: pass

def _center(im,fx=.72,fy=.92):
    h,w=im.shape[:2]; cw=max(8,int(w*fx)); ch=max(8,int(h*fy)); x=(w-cw)//2; y=(h-ch)//2; return im[y:y+ch,x:x+cw]

def _label(im):
    c=_center(im); h,w=c.shape[:2]; return c[int(h*.30):int(h*.68),int(w*.10):int(w*.90)]

def _resize(im,size=256):
    cv2,_=_vision_imports(); return cv2.resize(im,(size,size),interpolation=cv2.INTER_AREA)

def _edge_similarity(a,b):
    cv2,np=_vision_imports(); aa=cv2.dilate(cv2.Canny(cv2.cvtColor(_resize(a),cv2.COLOR_BGR2GRAY),50,150),np.ones((3,3),np.uint8)); bb=cv2.dilate(cv2.Canny(cv2.cvtColor(_resize(b),cv2.COLOR_BGR2GRAY),50,150),np.ones((3,3),np.uint8)); inter=np.logical_and(aa>0,bb>0).sum(); union=np.logical_or(aa>0,bb>0).sum(); return float(inter/union) if union else 1.0

def _orb_similarity(a,b):
    cv2,_=_vision_imports(); aa=cv2.cvtColor(_resize(a),cv2.COLOR_BGR2GRAY); bb=cv2.cvtColor(_resize(b),cv2.COLOR_BGR2GRAY); orb=cv2.ORB_create(nfeatures=1200); ka,da=orb.detectAndCompute(aa,None); kb,db=orb.detectAndCompute(bb,None)
    if da is None or db is None or not ka or not kb: return 0.0
    matches=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da,db,k=2); good=[m for pair in matches if len(pair)==2 for m,n in [pair] if m.distance<.76*n.distance]; return float(min(1.0,len(good)/max(12,min(len(ka),len(kb))*.22)))

def _color_similarity(a,b):
    cv2,np=_vision_imports(); aa=cv2.cvtColor(_resize(a),cv2.COLOR_BGR2HSV); bb=cv2.cvtColor(_resize(b),cv2.COLOR_BGR2HSV); ha=cv2.calcHist([aa],[0,1],None,[32,32],[0,180,0,256]); hb=cv2.calcHist([bb],[0,1],None,[32,32],[0,180,0,256]); cv2.normalize(ha,ha); cv2.normalize(hb,hb); corr=float(cv2.compareHist(ha,hb,cv2.HISTCMP_CORREL)); return max(0.0,min(1.0,(corr+1)/2))

def _ocr(im):
    try:
        import pytesseract
        text=pytesseract.image_to_string(_label(im),config='--psm 6'); lines=[' '.join(x.split()) for x in text.splitlines() if x.strip()]; return lines
    except Exception: return []

def _saturated_lab(im):
    cv2,np=_vision_imports(); c=_label(im); hsv=cv2.cvtColor(c,cv2.COLOR_BGR2HSV); mask=(hsv[:,:,1]>90)&(hsv[:,:,2]>60); lab=cv2.cvtColor(c,cv2.COLOR_BGR2LAB).astype(np.float32)
    if not mask.any(): vals=lab.reshape(-1,3).mean(axis=0)
    else: vals=lab[mask].mean(axis=0)
    # OpenCV Lab uses L 0-255, a/b offset 128. Convert approximately to CIE Lab.
    return [float(vals[0]*100/255),float(vals[1]-128),float(vals[2]-128)]

def build_identity(payload):
    refs=payload.get('references') or []
    if not refs: raise RuntimeError('identity requires at least one reference')
    ims=[_decode_image(r['dataBase64']) for r in refs]; observed=[]
    for im in ims:
        for s in _ocr(im):
            if s and s not in observed: observed.append(s)
    return {'expectedOcrStrings':observed[:8],'logoReferenceAssetIds':[r['assetId'] for r in refs[:2]],'silhouetteReferenceAssetId':refs[0]['assetId'],'protectedColors':[{'name':'dominant-brand-color','referenceLab':_saturated_lab(ims[0]),'maxDeltaE':18}],'features':{'analyzer':'opencv-orb-edge-hsv','referenceCount':len(refs)}}

def analyze_product(payload):
    cv2,np=_vision_imports(); refs=payload.get('approvedReferences') or []
    if not refs: raise RuntimeError('analysis requires approved references')
    reference_images=[_decode_image(r['dataBase64']) for r in refs]; frames=_sample_candidate(payload['candidate'])
    if not frames: raise RuntimeError('candidate contains no decodable frames')
    logo=[]; sil=[]; color=[]; edge_density=[]; luma=[]; observed=[]
    for frame in frames:
        logo.append(max(_orb_similarity(_label(frame),_label(r)) for r in reference_images)); sil.append(max(_edge_similarity(_center(frame),_center(r)) for r in reference_images)); color.append(max(_color_similarity(_label(frame),_label(r)) for r in reference_images));
        edges=cv2.Canny(cv2.cvtColor(_resize(_center(frame)),cv2.COLOR_BGR2GRAY),50,150); edge_density.append(float((edges>0).mean())); luma.append(float(cv2.cvtColor(_resize(frame),cv2.COLOR_BGR2GRAY).mean()/255));
        for s in _ocr(frame):
            if s and s not in observed: observed.append(s)
    def low_percentile(v): return float(np.percentile(np.array(v,dtype=np.float32),20))
    temporal=max(0.0,min(1.0,1.0-float(np.std(np.array(logo)+np.array(sil)))*1.8)); seg=max(0.0,min(1.0,1.0-float(np.std(edge_density))*8)); flicker=max(0.0,min(1.0,float(np.std(luma))*3.5))
    return {'observedOcrStrings':observed[:12],'logoSimilarity':low_percentile(logo),'silhouetteSimilarity':low_percentile(sil),'colorSimilarity':low_percentile(color),'segmentationStability':seg,'temporalConsistency':temporal,'flickerScore':flicker}

class Handler(BaseHTTPRequestHandler):
    config=None
    def send_json(self,code,obj):
        raw=json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type','application/json'); self.send_header('content-length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def body(self):
        length=int(self.headers.get('content-length','0')); return json.loads(self.rfile.read(length))
    def do_GET(self):
        if self.path=='/health': return self.send_json(200,{'ok':True,'backend':self.config['backend'],'productAnalyzer':'opencv-orb-edge-hsv'})
        if self.path=='/capabilities': return self.send_json(200,capabilities(self.config))
        return self.send_json(404,{'error':'not found'})
    def do_POST(self):
        try:
            if self.path=='/v1/generate': return self.send_json(200,generate(self.config,self.body()))
            if self.path=='/v1/build-identity': return self.send_json(200,build_identity(self.body()))
            if self.path=='/v1/analyze-product': return self.send_json(200,analyze_product(self.body()))
            return self.send_json(404,{'error':'not found'})
        except subprocess.CalledProcessError as e: return self.send_json(500,{'error':f'local backend failed with exit code {e.returncode}'})
        except Exception as e: return self.send_json(500,{'error':str(e)})
    def log_message(self,fmt,*args): print('[flick-local]',fmt%args)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--config',required=True); p.add_argument('--host',default='127.0.0.1'); p.add_argument('--port',type=int,default=7861); a=p.parse_args(); cfg=load_config(a.config); Handler.config=cfg
    print(f"FlickStack local worker: {cfg['backend']} on http://{a.host}:{a.port}")
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
if __name__=='__main__': main()
