use rquickjs::{Context, Runtime};

pub async fn execute_scraper(script: &str, r#type: &str, id: &str) -> Result<String, String> {
    let script = script.to_string();
    let type_val = r#type.to_string();
    let id_val = id.to_string();
    
    let (tx, rx) = std::sync::mpsc::channel();
    
    std::thread::spawn(move || {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();
        
        ctx.with(|ctx| {
            let tx_clone = tx.clone();
            let callback = rquickjs::Function::new(ctx.clone(), move |res: String| {
                let _ = tx_clone.send(res);
            }).unwrap();
            
            ctx.globals().set("rustCallback", callback).unwrap();
            
            let wrapper = format!(
                r#"
                {}
                
                async function runWrapper() {{
                    try {{
                        let res = await getStreams('{}', '{}');
                        rustCallback(JSON.stringify(res));
                    }} catch (e) {{
                        rustCallback(JSON.stringify({{ error: e.toString() }}));
                    }}
                }}
                runWrapper();
                "#,
                script, type_val, id_val
            );
            
            let _ = ctx.eval::<(), _>(wrapper);
            // Loop until no more jobs or error
            loop {
                let res = ctx.execute_pending_job();
                let debug = format!("{:?}", res);
                if debug.contains("false") || debug.contains("Err") {
                    break;
                }
            }
        });
    });
    
    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(res) => Ok(res),
        Err(_) => Err("Failed to execute scraper or timed out".to_string())
    }
}
