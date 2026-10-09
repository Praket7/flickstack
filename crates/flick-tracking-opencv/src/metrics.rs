pub fn point_confidence(forward_backward_error:f64, lk_error:f64, max_fb:f64)->f64 {
    let fb = if max_fb <= f64::EPSILON { 0.0 } else { 1.0 - (forward_backward_error / max_fb).clamp(0.0, 1.0) };
    let appearance = 1.0 / (1.0 + lk_error.max(0.0) / 12.0);
    (fb * appearance).clamp(0.0, 1.0)
}
pub fn planar_confidence(inlier_ratio:f64, reprojection_error:f64, threshold:f64)->f64 {
    let reprojection = if threshold <= f64::EPSILON { 0.0 } else { 1.0 - (reprojection_error / (threshold * 2.0)).clamp(0.0,1.0) };
    (inlier_ratio.clamp(0.0,1.0) * reprojection).clamp(0.0,1.0)
}
