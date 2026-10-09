use flick_motion_runtime::{animation::{eval_number, eval_vec3}, procedural::{evaluate_particles, evaluate_replicator, ParticleDefinition, ReplicatorDefinition}, EvaluatedScene as MotionScene};
use flick_render_contract::RenderProgramV1;
use flick_render_core::{
    build_text_instances, from_srgb8, EvaluatedScene, EvaluatedTextAnimator, FontResource,
    GradientStop, GlyphInstance, LineCap, LineJoin, LinearRgba, Paint, PathCommand,
    Primitive, RenderError, SceneLayer, StrokeStyle, TextPrimitive, TextSelectorEval,
    VectorPath, VectorPrimitive,
};
use flick_text::{TextAlign, TextEngine, TextLayoutRequest};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

fn num(v: Option<&Value>, default: f64) -> f64 { v.and_then(Value::as_f64).unwrap_or(default) }
fn arr2(v: Option<&Value>, default: [f32;2]) -> [f32;2] {
    let Some(a)=v.and_then(Value::as_array) else { return default };
    [a.first().and_then(Value::as_f64).unwrap_or(default[0] as f64) as f32,
     a.get(1).and_then(Value::as_f64).unwrap_or(default[1] as f64) as f32]
}
fn parse_hex(value:&str)->LinearRgba {
    let raw=value.trim().trim_start_matches('#');
    let expand=|c:char| -> String { format!("{c}{c}") };
    let (r,g,b,a)=match raw.len(){
        3 => (expand(raw.chars().nth(0).unwrap()),expand(raw.chars().nth(1).unwrap()),expand(raw.chars().nth(2).unwrap()),"ff".into()),
        4 => (expand(raw.chars().nth(0).unwrap()),expand(raw.chars().nth(1).unwrap()),expand(raw.chars().nth(2).unwrap()),expand(raw.chars().nth(3).unwrap())),
        6 => (raw[0..2].into(),raw[2..4].into(),raw[4..6].into(),"ff".into()),
        8 => (raw[0..2].into(),raw[2..4].into(),raw[4..6].into(),raw[6..8].into()),
        _ => return LinearRgba::TRANSPARENT,
    };
    from_srgb8(u8::from_str_radix(&r,16).unwrap_or(0),u8::from_str_radix(&g,16).unwrap_or(0),u8::from_str_radix(&b,16).unwrap_or(0),u8::from_str_radix(&a,16).unwrap_or(255))
}
fn color_property(prop:Option<&Value>)->LinearRgba {
    let value=prop.and_then(|p|p.get("baseValue")).and_then(Value::as_str).unwrap_or("#ffffff");
    parse_hex(value)
}
fn paint_property(prop:Option<&Value>)->Option<Paint>{ prop.map(|p|Paint::Solid(color_property(Some(p)))) }
fn affine(matrix:[f64;16])->[f32;6]{[matrix[0] as f32,matrix[4] as f32,matrix[1] as f32,matrix[5] as f32,matrix[3] as f32,matrix[7] as f32]}
fn compose_affine(a:[f32;6],b:[f32;6])->[f32;6]{
    // kurbo/Vello ordering: x'=a*x+c*y+e, y'=b*x+d*y+f.
    [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]
}
fn translate(x:f32,y:f32)->[f32;6]{[1.,0.,0.,1.,x,y]}
fn scale_rotate(sx:f32,sy:f32,deg:f32)->[f32;6]{let r=deg.to_radians();let(c,s)=(r.cos(),r.sin());[c*sx,s*sx,-s*sy,c*sy,0.,0.]}

fn rounded_rect(w:f32,h:f32,r:f32)->VectorPath{
    let r=r.max(0.).min(w.abs()/2.).min(h.abs()/2.);
    if r<=0. {return VectorPath{commands:vec![PathCommand::MoveTo(0.,0.),PathCommand::LineTo(w,0.),PathCommand::LineTo(w,h),PathCommand::LineTo(0.,h),PathCommand::Close]}}
    VectorPath{commands:vec![PathCommand::MoveTo(r,0.),PathCommand::LineTo(w-r,0.),PathCommand::QuadTo(w,0.,w,r),PathCommand::LineTo(w,h-r),PathCommand::QuadTo(w,h,w-r,h),PathCommand::LineTo(r,h),PathCommand::QuadTo(0.,h,0.,h-r),PathCommand::LineTo(0.,r),PathCommand::QuadTo(0.,0.,r,0.),PathCommand::Close]}
}
fn ellipse(rx:f32,ry:f32)->VectorPath{
    let k=0.552_284_8;VectorPath{commands:vec![PathCommand::MoveTo(rx,0.),PathCommand::CubicTo(rx,k*ry,k*rx,ry,0.,ry),PathCommand::CubicTo(-k*rx,ry,-rx,k*ry,-rx,0.),PathCommand::CubicTo(-rx,-k*ry,-k*rx,-ry,0.,-ry),PathCommand::CubicTo(k*rx,-ry,rx,-k*ry,rx,0.),PathCommand::Close]}
}
fn shape_path(shape:&Value)->Result<VectorPath,RenderError>{
    let kind=shape.get("kind").and_then(Value::as_str).ok_or_else(||RenderError::Invalid("shape kind missing".into()))?;
    Ok(match kind{
        "rect"=>rounded_rect(num(shape.get("width"),0.) as f32,num(shape.get("height"),0.) as f32,num(shape.get("radius"),0.) as f32),
        "ellipse"=>ellipse(num(shape.get("rx"),0.) as f32,num(shape.get("ry"),0.) as f32),
        "line"=>{let a=arr2(shape.get("from"),[0.,0.]);let b=arr2(shape.get("to"),[0.,0.]);VectorPath{commands:vec![PathCommand::MoveTo(a[0],a[1]),PathCommand::LineTo(b[0],b[1])]}}
        "polygon"=>{let points=shape.get("points").and_then(Value::as_array).cloned().unwrap_or_default();let mut c=vec![];for (i,p) in points.iter().enumerate(){let q=arr2(Some(p),[0.,0.]);if i==0{c.push(PathCommand::MoveTo(q[0],q[1]))}else{c.push(PathCommand::LineTo(q[0],q[1]))}}if !c.is_empty(){c.push(PathCommand::Close)}VectorPath{commands:c}}
        "star"=>{let n=num(shape.get("points"),5.) as usize;let inner=num(shape.get("innerRadius"),20.) as f32;let outer=num(shape.get("outerRadius"),40.) as f32;let rot=num(shape.get("rotation"),-90.) as f32;let mut c=Vec::with_capacity(n*2+1);for i in 0..n*2{let a=(rot+i as f32*180./n.max(1) as f32).to_radians();let r=if i%2==0{outer}else{inner};let(x,y)=(a.cos()*r,a.sin()*r);if i==0{c.push(PathCommand::MoveTo(x,y))}else{c.push(PathCommand::LineTo(x,y))}}c.push(PathCommand::Close);VectorPath{commands:c}}
        "path"=>{let points=shape.get("points").and_then(Value::as_array).cloned().unwrap_or_default();let mut c=vec![];for (i,p) in points.iter().enumerate(){let q=arr2(p.get("point"),[0.,0.]);if i==0{c.push(PathCommand::MoveTo(q[0],q[1]));continue}let prev=&points[i-1];let prev_pt=arr2(prev.get("point"),[0.,0.]);let prev_out=arr2(prev.get("out"),[0.,0.]);let inc=arr2(p.get("in"),[0.,0.]);if prev.get("out").is_some()||p.get("in").is_some(){c.push(PathCommand::CubicTo(prev_pt[0]+prev_out[0],prev_pt[1]+prev_out[1],q[0]+inc[0],q[1]+inc[1],q[0],q[1]))}else{c.push(PathCommand::LineTo(q[0],q[1]))}}if shape.get("closed").and_then(Value::as_bool).unwrap_or(false){c.push(PathCommand::Close)}VectorPath{commands:c}}
        other=>return Err(RenderError::Invalid(format!("unsupported shape {other}"))),
    })
}
fn vector_primitive(layer:&Value, matrix:[f64;16], opacity:f32, frame:u32)->Result<VectorPrimitive,RenderError>{
    let shape=layer.get("shape").ok_or_else(||RenderError::Invalid("shape layer missing geometry".into()))?;
    let style=layer.get("shapeStyle").unwrap_or(&Value::Null);
    let fill=if let Some(g)=style.get("fillGradient"){
        let stops=g.get("stops").and_then(Value::as_array).map(|s|s.iter().map(|v|GradientStop{offset:num(v.get("offset"),0.) as f32,color:parse_hex(v.get("color").and_then(Value::as_str).unwrap_or("#ffffff"))}).collect()).unwrap_or_default();
        match g.get("type").and_then(Value::as_str).unwrap_or("linear"){
            "radial"=>Some(Paint::RadialGradient{center:arr2(g.get("from"),[0.,0.]),radius:{let a=arr2(g.get("from"),[0.,0.]);let b=arr2(g.get("to"),[1.,0.]);((b[0]-a[0]).powi(2)+(b[1]-a[1]).powi(2)).sqrt().max(1.)},stops}),
            _=>Some(Paint::LinearGradient{from:arr2(g.get("from"),[0.,0.]),to:arr2(g.get("to"),[1.,0.]),stops}),
        }
    }else{paint_property(style.get("fill"))};
    let stroke=style.get("stroke").map(|p|{
        let width=style.get("strokeWidth").map(|v|eval_number(v,frame as f64)).unwrap_or(1.) as f32;
        let cap=match style.get("lineCap").and_then(Value::as_str){Some("round")=>LineCap::Round,Some("square")=>LineCap::Square,_=>LineCap::Butt};
        let join=match style.get("lineJoin").and_then(Value::as_str){Some("round")=>LineJoin::Round,Some("bevel")=>LineJoin::Bevel,_=>LineJoin::Miter};
        let dash=style.get("dash").and_then(Value::as_array).map(|a|a.iter().filter_map(Value::as_f64).map(|v|v as f32).collect()).unwrap_or_default();
        (Paint::Solid(color_property(Some(p))),StrokeStyle{width,cap,join,miter_limit:4.,dash,dash_offset:0.})
    });
    let style_opacity=style.get("opacity").map(|v|eval_number(v,frame as f64)).unwrap_or(1.) as f32;
    Ok(VectorPrimitive{path:shape_path(shape)?,fill,stroke,transform:affine(matrix),opacity:opacity*style_opacity})
}

fn selector_map(layer:&Value)->HashMap<String,TextSelectorEval>{
    let mut map=HashMap::new();
    for s in layer.get("textSelectors").and_then(Value::as_array).into_iter().flatten(){
        let Some(id)=s.get("id").and_then(Value::as_str) else{continue};let kind=s.get("type").and_then(Value::as_str).unwrap_or("");
        let selector=match kind{
            "characters"=>TextSelectorEval::Characters{start:s.get("start").and_then(Value::as_u64).unwrap_or(0)as usize,end:s.get("end").and_then(Value::as_u64).unwrap_or(u64::MAX)as usize},
            "words"=>TextSelectorEval::Words{start:s.get("start").and_then(Value::as_u64).unwrap_or(0)as usize,end:s.get("end").and_then(Value::as_u64).unwrap_or(u64::MAX)as usize},
            "lines"=>TextSelectorEval::Lines{start:s.get("start").and_then(Value::as_u64).unwrap_or(0)as usize,end:s.get("end").and_then(Value::as_u64).unwrap_or(u64::MAX)as usize},
            "index-range"=>TextSelectorEval::IndexRange{start:s.get("start").and_then(Value::as_u64).unwrap_or(0)as usize,end:s.get("end").and_then(Value::as_u64).unwrap_or(0)as usize},
            "percent-range"=>TextSelectorEval::PercentRange{start:num(s.get("start"),0.)as f32,end:num(s.get("end"),100.)as f32},
            "regex"=>TextSelectorEval::Regex{pattern:s.get("pattern").and_then(Value::as_str).unwrap_or("").into()},
            "seeded-random"=>TextSelectorEval::SeededRandom{probability:num(s.get("probability"),1.)as f32,seed:s.get("seed").and_then(Value::as_u64).unwrap_or(0)},
            _=>continue,
        };map.insert(id.into(),selector);
    }map
}
fn text_animators(layer:&Value,frame:u32)->Vec<EvaluatedTextAnimator>{
    let selectors=selector_map(layer);layer.get("textAnimators").and_then(Value::as_array).into_iter().flatten().map(|a|{
        let ids=a.get("selectorIds").and_then(Value::as_array).cloned().unwrap_or_default();
        EvaluatedTextAnimator{
            selectors:ids.iter().filter_map(Value::as_str).filter_map(|id|selectors.get(id).cloned()).collect(),
            position:a.get("position").map(|v|eval_vec3(v,frame as f64).map(|x|x as f32)).unwrap_or([0.;3]),
            scale:a.get("scale").map(|v|eval_vec3(v,frame as f64).map(|x|x as f32)).unwrap_or([1.;3]),
            rotation:a.get("rotation").map(|v|eval_vec3(v,frame as f64).map(|x|x as f32)).unwrap_or([0.;3]),
            opacity:a.get("opacity").map(|v|eval_number(v,frame as f64)as f32).unwrap_or(1.),
            blur:a.get("blur").map(|v|eval_number(v,frame as f64)as f32).unwrap_or(0.),
            tracking:a.get("tracking").map(|v|eval_number(v,frame as f64)as f32).unwrap_or(0.),
        }
    }).collect()
}
fn weight(style:&Value)->u16{style.get("fontWeight").and_then(|v|v.as_u64().or_else(||v.as_str().and_then(|s|s.parse().ok()))).unwrap_or(400).clamp(1,1000)as u16}
fn text_primitive(layer:&Value,matrix:[f64;16],opacity:f32,frame:u32,text_engine:&mut TextEngine,fonts:&mut HashMap<String,FontResource>)->Result<TextPrimitive,RenderError>{
    let text=layer.get("text").and_then(Value::as_str).unwrap_or("");let style=layer.get("textStyle").unwrap_or(&Value::Null);
    let font_size=style.get("fontSize").map(|v|eval_number(v,frame as f64)).unwrap_or(48.0)as f32;
    let line_height=style.get("lineHeight").map(|v|eval_number(v,frame as f64)).unwrap_or(font_size as f64*1.2)as f32;
    let tracking=style.get("tracking").map(|v|eval_number(v,frame as f64)).unwrap_or(0.)as f32;
    let family=style.get("fontFamily").and_then(Value::as_str).unwrap_or("sans-serif").to_string();
    let max_width=style.get("paragraphBox").and_then(|p|p.get("width")).and_then(Value::as_f64).map(|x|x as f32);
    let align=match style.get("horizontalAlign").and_then(Value::as_str){Some("center")=>TextAlign::Center,Some("right")=>TextAlign::Right,Some("justify")=>TextAlign::Justify,_=>TextAlign::Left};
    let variation_axes=style.get("variableAxes").and_then(Value::as_object).map(|m|m.iter().filter_map(|(k,v)|v.as_f64().map(|x|(k.clone(),x as f32))).collect()).unwrap_or_default();
    let layout=text_engine.layout(&TextLayoutRequest{text:text.into(),families:vec![family],font_size,line_height,tracking,max_width,align,weight:weight(style),variation_axes}).map_err(|e|RenderError::Backend(format!("text shape: {e}")))?;
    for run in &layout.runs{fonts.entry(run.font_identity.clone()).or_insert_with(||FontResource{identity:run.font_identity.clone(),index:run.font_index,bytes:run.font_bytes.clone()});}
    let mut glyphs=build_text_instances(&layout,&text_animators(layer,frame));
    let a=affine(matrix);
    for glyph in &mut glyphs{
        let local=compose_affine(translate(glyph.position[0],glyph.position[1]),scale_rotate(glyph.scale[0],glyph.scale[1],glyph.rotation[2]));
        let m=compose_affine(a,local);let x=m[0]*glyph.x+m[2]*glyph.y+m[4];let y=m[1]*glyph.x+m[3]*glyph.y+m[5];glyph.x=x;glyph.y=y;glyph.position=[0.;3];glyph.scale=[1.,1.,1.];glyph.rotation=[0.;3];
    }
    Ok(TextPrimitive{glyphs,paint:Paint::Solid(color_property(style.get("fill"))),opacity})
}
fn particle_layer(layer:&Value,evaluated:&flick_motion_runtime::EvaluatedLayer,frame:u32,fps:f64)->Result<Vec<SceneLayer>,RenderError>{
    let Some(p)=layer.get("particle") else{return Ok(vec![])};let def:ParticleDefinition=serde_json::from_value(p.clone()).map_err(|e|RenderError::Invalid(format!("particle: {e}")))?;
    let particles=evaluate_particles(&def,frame,fps).map_err(|e|RenderError::Invalid(e.to_string()))?;let mut out=Vec::with_capacity(particles.len());for x in particles{let r=(5.*x.scale.max(.1))as f32;let path=ellipse(r,r);let pos=[evaluated.matrix[3]+x.position[0],evaluated.matrix[7]+x.position[1],evaluated.matrix[11]+x.position[2]];let tr=translate(pos[0]as f32,pos[1]as f32);let fade=(1.-x.normalized_age).clamp(0.,1.)as f32;out.push(SceneLayer{id:x.id,z_index:evaluated.z_index as i32,opacity:evaluated.opacity as f32*fade,primitive:Primitive::Vector(VectorPrimitive{path,fill:Some(Paint::Solid(parse_hex(&x.color))),stroke:None,transform:tr,opacity:1.})});}Ok(out)
}
fn replicated_layers(base:&SceneLayer,layer:&Value,evaluated:&flick_motion_runtime::EvaluatedLayer)->Result<Vec<SceneLayer>,RenderError>{
    let Some(r)=layer.get("replicator") else{return Ok(vec![base.clone()])};let def:ReplicatorDefinition=serde_json::from_value(r.clone()).map_err(|e|RenderError::Invalid(format!("replicator: {e}")))?;let items=evaluate_replicator(&def).map_err(|e|RenderError::Invalid(e.to_string()))?;let mut out=Vec::with_capacity(items.len());for item in items{let mut copy=base.clone();copy.id=item.id;copy.opacity*=1.0;match &mut copy.primitive{Primitive::Vector(v)=>{let local=compose_affine(translate(item.position[0]as f32,item.position[1]as f32),scale_rotate(item.scale[0]as f32,item.scale[1]as f32,item.rotation[2]as f32));v.transform=compose_affine(affine(evaluated.matrix),local)},Primitive::Text(t)=>for g in &mut t.glyphs{g.x+=item.position[0]as f32;g.y+=item.position[1]as f32;}}out.push(copy)}Ok(out)
}

pub fn build_scene(program:&RenderProgramV1,motion:&MotionScene,frame:u32,text_engine:&mut TextEngine)->Result<EvaluatedScene,RenderError>{
    let by_id:HashMap<&str,&Value>=program.layers.iter().filter_map(|v|v.get("id").and_then(Value::as_str).map(|id|(id,v))).collect();let mut fonts=HashMap::<String,FontResource>::new();let mut layers=Vec::<SceneLayer>::new();let mut seen=HashSet::new();
    for e in &motion.layers{let Some(source)=by_id.get(e.id.as_str()).copied()else{continue};if source.get("enabled").and_then(Value::as_bool)==Some(false){continue}match e.kind.as_str(){
        "shape"=>{let base=SceneLayer{id:e.id.clone(),z_index:e.z_index as i32,opacity:e.opacity as f32,primitive:Primitive::Vector(vector_primitive(source,e.matrix,1.,frame)?)};for l in replicated_layers(&base,source,e)?{if seen.insert(l.id.clone()){layers.push(l)}}},
        "text"=>{let base=SceneLayer{id:e.id.clone(),z_index:e.z_index as i32,opacity:e.opacity as f32,primitive:Primitive::Text(text_primitive(source,e.matrix,1.,frame,text_engine,&mut fonts)?)};for l in replicated_layers(&base,source,e)?{if seen.insert(l.id.clone()){layers.push(l)}}},
        "particle"=>for l in particle_layer(source,e,frame,program.surface.fps)?{if seen.insert(l.id.clone()){layers.push(l)}},
        _=>{}
    }}
    layers.sort_by(|a,b|a.z_index.cmp(&b.z_index).then_with(||a.id.cmp(&b.id)));
    Ok(EvaluatedScene{width:program.surface.width as u32,height:program.surface.height as u32,background:parse_hex(&motion.background),layers,fonts:fonts.into_values().collect()})
}
