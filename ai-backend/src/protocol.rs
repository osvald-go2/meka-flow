use serde::{Deserialize, Serialize};

/// Incoming request from Electron main process
#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: String,
    pub method: String,
    #[serde(default)]
    pub params: serde_json::Value,
}

/// Outgoing response (success)
#[derive(Debug, Serialize)]
pub struct Response {
    pub id: String,
    pub result: serde_json::Value,
}

/// Outgoing response (error)
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub id: String,
    pub error: ProtocolError,
}

#[derive(Debug, Serialize)]
pub struct ProtocolError {
    pub code: i32,
    pub message: String,
}

/// Outgoing streaming event (no id)
#[derive(Debug, Serialize)]
pub struct Event {
    pub event: String,
    pub data: serde_json::Value,
}

/// Union type for anything written to stdout
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum OutgoingMessage {
    Response(Response),
    Error(ErrorResponse),
    Event(Event),
}

impl Response {
    pub fn ok(id: String, result: serde_json::Value) -> OutgoingMessage {
        OutgoingMessage::Response(Response { id, result })
    }
}

impl ErrorResponse {
    pub fn new(id: String, code: i32, message: String) -> OutgoingMessage {
        OutgoingMessage::Error(ErrorResponse {
            id,
            error: ProtocolError { code, message },
        })
    }
}

impl Event {
    pub fn new(event: &str, data: serde_json::Value) -> OutgoingMessage {
        OutgoingMessage::Event(Event {
            event: event.to_string(),
            data,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_request_deserialize() {
        let input = r#"{"id":"req_1","method":"ping","params":{}}"#;
        let req: Request = serde_json::from_str(input).unwrap();
        assert_eq!(req.id, "req_1");
        assert_eq!(req.method, "ping");
    }

    #[test]
    fn test_request_no_params() {
        let input = r#"{"id":"req_1","method":"ping"}"#;
        let req: Request = serde_json::from_str(input).unwrap();
        assert_eq!(req.method, "ping");
        assert!(req.params.is_null());
    }

    #[test]
    fn test_response_serialize() {
        let msg = Response::ok("req_1".into(), json!({"session_id": "abc"}));
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"id\":\"req_1\""));
        assert!(json.contains("\"session_id\":\"abc\""));
        assert!(!json.contains("\"event\""));
    }

    #[test]
    fn test_error_serialize() {
        let msg = ErrorResponse::new("req_2".into(), 1001, "not found".into());
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"code\":1001"));
        assert!(json.contains("\"not found\""));
    }

    #[test]
    fn test_event_serialize() {
        let msg = Event::new("block.start", json!({"session_id": "s1", "block_index": 0}));
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"event\":\"block.start\""));
        assert!(json.contains("\"session_id\":\"s1\""));
        assert!(!json.contains("\"id\""));
    }
}
