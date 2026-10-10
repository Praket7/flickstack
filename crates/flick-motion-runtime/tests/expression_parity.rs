use flick_motion_runtime::expression::{
    evaluate_expression, ExpressionContext, ExpressionProgramV1,
};

#[test]
fn evaluates_portable_program() {
    let p: ExpressionProgramV1 = serde_json::from_str(
        r#"{"version":1,"source":"frame+2","maxOperations":8,"instructions":[{"op":"load","name":"frame"},{"op":"const","value":2},{"op":"add"}]}"#,
    )
    .unwrap();
    let c = ExpressionContext {
        frame: 3.0,
        ..Default::default()
    };
    assert_eq!(evaluate_expression(&p, &c).unwrap(), 5.0);
}
