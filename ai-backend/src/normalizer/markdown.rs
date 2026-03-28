use super::blocks::ContentBlock;

/// Split text containing markdown code fences into text/code ContentBlocks.
///
/// Input: "Some text\n```rust\nfn main(){}\n```\nMore text"
/// Output: [Text("Some text\n"), Code("fn main(){}", "rust"), Text("\nMore text")]
pub fn split_code_blocks(text: &str) -> Vec<ContentBlock> {
    let mut blocks = Vec::new();
    let mut remaining = text;

    while let Some(fence_start) = remaining.find("```") {
        // Text before the fence
        let before = &remaining[..fence_start];
        if !before.is_empty() {
            blocks.push(ContentBlock::Text { content: before.to_string() });
        }

        // Skip opening ```
        let after_fence = &remaining[fence_start + 3..];

        // Extract language (everything until newline)
        let (language, code_start) = match after_fence.find('\n') {
            Some(nl) => {
                let lang = after_fence[..nl].trim().to_string();
                (lang, nl + 1)
            }
            None => {
                // Unclosed fence at end of string — treat as text
                blocks.push(ContentBlock::Text { content: remaining[fence_start..].to_string() });
                return blocks;
            }
        };

        let code_content = &after_fence[code_start..];

        // Find closing ```
        match code_content.find("```") {
            Some(close_pos) => {
                let code = code_content[..close_pos].trim_end_matches('\n').to_string();
                let lang = if language.is_empty() { "plaintext".to_string() } else { language };
                blocks.push(ContentBlock::Code { code, language: lang });

                // Continue after closing ```
                let after_close = &code_content[close_pos + 3..];
                // Skip trailing newline after closing fence
                remaining = after_close.strip_prefix('\n').unwrap_or(after_close);
            }
            None => {
                // Unclosed fence — treat rest as code
                let code = code_content.trim_end_matches('\n').to_string();
                let lang = if language.is_empty() { "plaintext".to_string() } else { language };
                blocks.push(ContentBlock::Code { code, language: lang });
                return blocks;
            }
        }
    }

    // Remaining text after all fences
    if !remaining.is_empty() {
        blocks.push(ContentBlock::Text { content: remaining.to_string() });
    }

    blocks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plain_text_no_fences() {
        let blocks = split_code_blocks("Hello world");
        assert_eq!(blocks.len(), 1);
        assert!(matches!(&blocks[0], ContentBlock::Text { content } if content == "Hello world"));
    }

    #[test]
    fn test_single_code_block() {
        let input = "Before\n```rust\nfn main() {}\n```\nAfter";
        let blocks = split_code_blocks(input);
        assert_eq!(blocks.len(), 3);
        assert!(matches!(&blocks[0], ContentBlock::Text { content } if content == "Before\n"));
        assert!(matches!(&blocks[1], ContentBlock::Code { code, language } if code == "fn main() {}" && language == "rust"));
        assert!(matches!(&blocks[2], ContentBlock::Text { content } if content == "After"));
    }

    #[test]
    fn test_no_language_specified() {
        let input = "```\nsome code\n```";
        let blocks = split_code_blocks(input);
        assert_eq!(blocks.len(), 1);
        assert!(matches!(&blocks[0], ContentBlock::Code { language, .. } if language == "plaintext"));
    }

    #[test]
    fn test_multiple_code_blocks() {
        let input = "Text1\n```js\nconst a = 1;\n```\nText2\n```py\nprint('hi')\n```\nText3";
        let blocks = split_code_blocks(input);
        assert_eq!(blocks.len(), 5);
        assert!(matches!(&blocks[0], ContentBlock::Text { .. }));
        assert!(matches!(&blocks[1], ContentBlock::Code { language, .. } if language == "js"));
        assert!(matches!(&blocks[2], ContentBlock::Text { .. }));
        assert!(matches!(&blocks[3], ContentBlock::Code { language, .. } if language == "py"));
        assert!(matches!(&blocks[4], ContentBlock::Text { .. }));
    }

    #[test]
    fn test_code_only_no_surrounding_text() {
        let input = "```typescript\nconst x = 1;\n```";
        let blocks = split_code_blocks(input);
        assert_eq!(blocks.len(), 1);
        assert!(matches!(&blocks[0], ContentBlock::Code { language, .. } if language == "typescript"));
    }
}
