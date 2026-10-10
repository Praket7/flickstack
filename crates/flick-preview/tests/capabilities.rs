#[test]
fn reports_native_backend() {
    let c = flick_preview::capabilities();
    assert_eq!(c.backend, "native");
}
