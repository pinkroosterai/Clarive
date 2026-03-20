using System.Text;

namespace Clarive.Core.Helpers;

/// <summary>
/// Stateful streaming parser that separates &lt;think&gt;...&lt;/think&gt; content
/// from regular text. Handles tags split across chunk boundaries.
///
/// Design notes:
/// - Orphan &lt;/think&gt; tags (outside a think block) are silently stripped
///   to prevent raw tags leaking into visible output.
/// - A max buffer safety valve (50KB) prevents unbounded memory growth
///   if a model opens &lt;think&gt; but never closes it.
/// - The parser is always active in Chat Completions mode regardless of
///   ShowReasoning — <think> tags must be stripped from visible text even
///   when the user hasn't requested reasoning display.
/// </summary>
public class ThinkTagStreamParser
{
    private const string OpenTag = "<think>";
    private const string CloseTag = "</think>";
    private const int MaxBufferSize = 50 * 1024; // 50KB safety valve

    private readonly StringBuilder _buffer = new();
    private bool _insideThink;

    /// <summary>
    /// Process a streaming chunk and return segments of (text, isThinking).
    /// </summary>
    public List<(string Text, bool IsThinking)> ProcessChunk(string? chunk)
    {
        if (string.IsNullOrEmpty(chunk))
            return [];

        _buffer.Append(chunk);
        return Drain(flush: false);
    }

    /// <summary>
    /// Flush any remaining buffered content at end-of-stream.
    /// </summary>
    public List<(string Text, bool IsThinking)> Flush() => Drain(flush: true);

    private List<(string Text, bool IsThinking)> Drain(bool flush)
    {
        var segments = new List<(string, bool)>();
        var text = _buffer.ToString();

        while (text.Length > 0)
        {
            if (_insideThink)
            {
                var closeIdx = text.IndexOf(CloseTag, StringComparison.Ordinal);
                if (closeIdx >= 0)
                {
                    if (closeIdx > 0)
                        segments.Add((text[..closeIdx], true));
                    _insideThink = false;
                    text = text[(closeIdx + CloseTag.Length)..];
                    continue;
                }

                // No close tag — check for partial or apply safety valve
                if (!flush)
                {
                    var partialLen = FindPartialTagMatch(text, CloseTag);
                    if (partialLen > 0)
                    {
                        var safeLen = text.Length - partialLen;
                        if (safeLen > 0)
                            segments.Add((text[..safeLen], true));
                        SetBuffer(text[^partialLen..]);
                        return segments;
                    }

                    // Safety valve: if buffer exceeds max without a close tag, flush as thinking
                    if (text.Length > MaxBufferSize)
                    {
                        segments.Add((text, true));
                        _insideThink = false;
                        SetBuffer("");
                        return segments;
                    }
                }

                // Flush mode or no partial: emit all as thinking
                segments.Add((text, true));
                text = "";
            }
            else
            {
                // Outside think block — look for open tag
                var openIdx = text.IndexOf(OpenTag, StringComparison.Ordinal);

                // Also check for orphan </think> that appears before any <think>
                var orphanCloseIdx = text.IndexOf(CloseTag, StringComparison.Ordinal);
                if (orphanCloseIdx >= 0 && (openIdx < 0 || orphanCloseIdx < openIdx))
                {
                    // Orphan close tag — strip it silently
                    if (orphanCloseIdx > 0)
                        segments.Add((text[..orphanCloseIdx], false));
                    text = text[(orphanCloseIdx + CloseTag.Length)..];
                    continue;
                }

                if (openIdx >= 0)
                {
                    if (openIdx > 0)
                        segments.Add((text[..openIdx], false));
                    _insideThink = true;
                    text = text[(openIdx + OpenTag.Length)..];
                    continue;
                }

                // No tags found — check for partial open tag at end
                if (!flush)
                {
                    var partialLen = FindPartialTagMatch(text, OpenTag);
                    // Also check for partial orphan close tag
                    var partialClose = FindPartialTagMatch(text, CloseTag);
                    var maxPartial = Math.Max(partialLen, partialClose);

                    if (maxPartial > 0)
                    {
                        var safeLen = text.Length - maxPartial;
                        if (safeLen > 0)
                            segments.Add((text[..safeLen], false));
                        SetBuffer(text[^maxPartial..]);
                        return segments;
                    }
                }

                // No partial match — emit everything
                segments.Add((text, false));
                text = "";
            }
        }

        _buffer.Clear();
        return segments;
    }

    private void SetBuffer(string value)
    {
        _buffer.Clear();
        _buffer.Append(value);
    }

    /// <summary>
    /// Check if the end of the text matches the beginning of the tag.
    /// Returns the length of the partial match, or 0 if none.
    /// </summary>
    private static int FindPartialTagMatch(string text, string tag)
    {
        var maxCheck = Math.Min(text.Length, tag.Length - 1);
        for (var len = maxCheck; len > 0; len--)
        {
            if (text.EndsWith(tag[..len], StringComparison.Ordinal))
                return len;
        }
        return 0;
    }
}
