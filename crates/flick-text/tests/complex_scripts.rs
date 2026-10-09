use flick_text::{TextAlign, TextDirection, TextEngine, TextLayoutRequest};
fn req(text:&str)->TextLayoutRequest{TextLayoutRequest{text:text.into(),families:vec!["Noto Sans".into(),"Noto Sans Arabic".into(),"Noto Sans Devanagari".into(),"Noto Sans CJK JP".into()],font_size:36.0,line_height:44.0,tracking:0.0,max_width:Some(600.0),align:TextAlign::Left,weight:400,variation_axes:vec![]}}
#[test]
fn shapes_arabic_bidi_emoji_devanagari_and_cjk_as_atomic_clusters(){
    let mut e=TextEngine::new();
    for s in ["مرحبا بالعالم","नमस्ते दुनिया","日本語の改行テスト","hello مرحبا 👨‍👩‍👧‍👦"]{
        let l=e.layout(&req(s)).unwrap();
        assert!(l.runs.iter().any(|r|!r.glyphs.is_empty()));
        assert!(l.runs.iter().flat_map(|r|&r.clusters).all(|cluster| cluster.end>cluster.start));
    }
    assert_eq!(e.layout(&req("hello مرحبا")).unwrap().direction,TextDirection::Mixed);
}
