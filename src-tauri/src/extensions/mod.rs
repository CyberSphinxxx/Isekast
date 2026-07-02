use boa_engine::{js_string, Context, JsValue, Source};

pub fn execute_scraper(script: &str, id: &str) -> Result<String, String> {
    let mut context = Context::default();

    // Load the scraper script
    context
        .eval(Source::from_bytes(script))
        .map_err(|e| format!("Eval Error: {:?}", e))?;

    // Call the expected global function `getStreams(id)`
    let call_script = format!("getStreams('{}');", id);
    let result = context
        .eval(Source::from_bytes(&call_script))
        .map_err(|e| format!("JS Error: {:?}", e))?;

    // Stringify the result using JS JSON.stringify
    let global_obj = context.global_object();
    let json = global_obj
        .get(js_string!("JSON"), &mut context)
        .map_err(|e| format!("{:?}", e))?;
    let json_obj = json
        .as_object()
        .ok_or_else(|| "JSON not found".to_string())?;

    let stringify = json_obj
        .get(js_string!("stringify"), &mut context)
        .map_err(|e| format!("{:?}", e))?;
    let stringify_fn = stringify
        .as_callable()
        .ok_or_else(|| "stringify not callable".to_string())?;

    let json_string = stringify_fn
        .call(&JsValue::undefined(), &[result], &mut context)
        .map_err(|e| format!("{:?}", e))?;

    if let Some(s) = json_string.as_string() {
        Ok(s.to_std_string_escaped())
    } else {
        Err("Result is not a string".to_string())
    }
}
