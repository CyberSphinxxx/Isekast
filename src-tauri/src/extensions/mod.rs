use rquickjs::{Context, Runtime};

pub async fn execute_scraper(script: &str, r#type: &str, id: &str) -> Result<String, String> {
    let script = script.to_string();
    let type_val = r#type.to_string();
    let id_val = id.to_string();
    
    let (tx, rx) = std::sync::mpsc::channel();
    
    std::thread::spawn(move || {
        let rt = Runtime::new().unwrap();

        // === Sandbox Resource Limits ===
        // Prevent infinite loops from consuming all stack space.
        rt.set_max_stack_size(512 * 1024); // 512 KiB stack limit
        // Prevent OOM: restrict the JS heap to 8 MiB.
        rt.set_memory_limit(8 * 1024 * 1024); // 8 MiB memory limit

        let ctx = Context::full(&rt).unwrap();
        
        ctx.with(|ctx| {
            let tx_clone = tx.clone();
            let callback = rquickjs::Function::new(ctx.clone(), move |res: String| {
                let _ = tx_clone.send(res);
            }).unwrap();
            
            ctx.globals().set("rustCallback", callback).unwrap();

            // === Secure Parameter Passing ===
            // Parameters are injected as typed globals, not interpolated into the
            // raw JS source string, eliminating the code injection vector.
            ctx.globals().set("__SCRAPER_TYPE__", type_val).unwrap();
            ctx.globals().set("__SCRAPER_ID__", id_val).unwrap();
            
            // The wrapper invokes getStreams using the pre-set global variables
            // rather than string-formatted arguments.
            let wrapper = format!(
                r#"
                {}

                async function runWrapper() {{
                    try {{
                        let res = await getStreams(__SCRAPER_TYPE__, __SCRAPER_ID__);
                        rustCallback(JSON.stringify(res));
                    }} catch (e) {{
                        rustCallback(JSON.stringify({{ error: e.toString() }}));
                    }}
                }}
                runWrapper();
                "#,
                script
            );
            
            let _ = ctx.eval::<(), _>(wrapper);
            // Drain the microtask/job queue until exhausted.
            // rquickjs 0.8: execute_pending_job() returns bool —
            //   true  = a job was executed (keep draining)
            //   false = queue is empty (stop)
            while ctx.execute_pending_job() {}
        });
    });
    
    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(res) => Ok(res),
        Err(_) => Err("Failed to execute scraper or timed out".to_string())
    }
}
