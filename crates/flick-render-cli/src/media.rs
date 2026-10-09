#[derive(Clone,Debug,PartialEq,Eq,Hash)]pub struct MediaFrameKey{pub asset_id:String,pub frame:u32,pub width:u32,pub height:u32}
#[derive(Default)]pub struct MediaCache{pub last:Option<MediaFrameKey>}
impl MediaCache{pub fn invalidate_seek(&mut self){self.last=None}}
