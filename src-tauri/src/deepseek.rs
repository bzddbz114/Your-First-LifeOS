//! Minimal DeepSeek chat-completions client. Requests go out from Rust so the webview's
//! CORS rules don't apply and the key never passes through a browser fetch.

use serde::{Deserialize, Serialize};
use std::time::Duration;

const ENDPOINT: &str = "https://api.deepseek.com/chat/completions";

#[derive(Serialize, Deserialize)]
pub struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Deserialize)]
struct Completion {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct ApiError {
    error: ApiErrorBody,
}

#[derive(Deserialize)]
struct ApiErrorBody {
    message: String,
}

/// Sends `messages` in JSON-output mode and returns the assistant's reply text.
#[tauri::command]
pub async fn deepseek_chat(api_key: String, model: String, messages: Vec<Message>) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("还没有设置 DeepSeek API Key".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(ENDPOINT)
        .bearer_auth(api_key.trim())
        .json(&serde_json::json!({
            "model": model,
            "messages": messages,
            "response_format": { "type": "json_object" },
            "temperature": 0.7,
        }))
        .send()
        .await
        .map_err(|e| format!("无法连接 DeepSeek:{e}"))?;

    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let detail = serde_json::from_str::<ApiError>(&body)
            .map(|e| e.error.message)
            .unwrap_or(body);
        return Err(match status.as_u16() {
            401 => "API Key 无效,请在设置中检查".into(),
            402 => "DeepSeek 账户余额不足".into(),
            429 => "请求太频繁,请稍后再试".into(),
            _ => format!("DeepSeek 返回错误 {status}:{detail}"),
        });
    }
    let completion: Completion = serde_json::from_str(&body).map_err(|e| format!("无法解析回复:{e}"))?;
    completion
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "DeepSeek 没有返回内容".into())
}
