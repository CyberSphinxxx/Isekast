use librqbit::{Session, AddTorrent, AddTorrentOptions};
#[tokio::main]
async fn main() {
    let session = Session::new("/tmp/t".into()).await.unwrap();
    let h = session.add_torrent(AddTorrent::from_url("magnet:?xt=urn:btih:abc"), Some(AddTorrentOptions::default())).await.unwrap().into_handle().unwrap();
    println!("{:?}", h.id());
}
