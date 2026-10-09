#[test]
fn packaged_source_uses_loopback_and_node_strip_types() {
    let source=include_str!("../src/mcp.rs");
    assert!(source.contains("127.0.0.1"));
    assert!(source.contains("FLICKSMITH_HTTP_PORT"));
    assert!(source.contains("--experimental-strip-types"));
    assert!(source.contains("server.ts"));
}
