using Clarive.Api.Helpers;

namespace Clarive.Api.UnitTests.Helpers;

public class ThinkTagStreamParserTests
{
    // ── Basic parsing ──

    [Fact]
    public void SingleChunk_CompleteThinkBlock_SplitsCorrectly()
    {
        var parser = new ThinkTagStreamParser();
        var segments = parser.ProcessChunk("<think>reasoning</think>text");

        Assert.Equal(2, segments.Count);
        Assert.Equal(("reasoning", true), segments[0]);
        Assert.Equal(("text", false), segments[1]);
    }

    [Fact]
    public void NoThinkTags_ReturnsAllAsText()
    {
        var parser = new ThinkTagStreamParser();
        var segments = parser.ProcessChunk("hello world");
        var flushed = parser.Flush();

        var allText = ConcatText(segments.Concat(flushed), thinking: false);
        Assert.Equal("hello world", allText);
        Assert.DoesNotContain(segments.Concat(flushed), s => s.IsThinking);
    }

    [Fact]
    public void MultipleThinkBlocks()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "<think>first</think>middle<think>second</think>end");

        Assert.Equal("firstsecond", ConcatText(all, thinking: true));
        Assert.Equal("middleend", ConcatText(all, thinking: false));
    }

    [Fact]
    public void EmptyThinkBlock_ProducesNoThinkingContent()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "<think></think>text");

        Assert.Equal("", ConcatText(all, thinking: true));
        Assert.Equal("text", ConcatText(all, thinking: false));
    }

    [Fact]
    public void ThinkAtStartOfStream()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "<think>reasoning</think>");

        Assert.Contains(all, s => s is { IsThinking: true, Text: "reasoning" });
    }

    // ── Tag split across chunks ──

    [Fact]
    public void OpenTag_SplitAcrossChunks()
    {
        var parser = new ThinkTagStreamParser();
        var seg1 = parser.ProcessChunk("hello<thi");
        var seg2 = parser.ProcessChunk("nk>reasoning</think>world");
        var flushed = parser.Flush();
        var all = seg1.Concat(seg2).Concat(flushed).ToList();

        Assert.Equal("helloworld", ConcatText(all, thinking: false));
        Assert.Equal("reasoning", ConcatText(all, thinking: true));
    }

    [Fact]
    public void CloseTag_SplitAcrossChunks()
    {
        var parser = new ThinkTagStreamParser();
        var seg1 = parser.ProcessChunk("<think>reasoning</th");
        var seg2 = parser.ProcessChunk("ink>text");
        var flushed = parser.Flush();
        var all = seg1.Concat(seg2).Concat(flushed).ToList();

        Assert.Equal("reasoning", ConcatText(all, thinking: true));
        Assert.Equal("text", ConcatText(all, thinking: false));
    }

    [Fact]
    public void ManySmallChunks_CharacterByCharacter()
    {
        var parser = new ThinkTagStreamParser();
        var input = "<think>hello</think>world";
        var all = new List<(string Text, bool IsThinking)>();
        foreach (var ch in input)
            all.AddRange(parser.ProcessChunk(ch.ToString()));
        all.AddRange(parser.Flush());

        Assert.Equal("hello", ConcatText(all, thinking: true));
        Assert.Equal("world", ConcatText(all, thinking: false));
    }

    // ── Orphan tags ──

    [Fact]
    public void OrphanCloseTag_StrippedSilently()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "before</think>after");

        var text = ConcatText(all, thinking: false);
        Assert.Equal("beforeafter", text);
        Assert.DoesNotContain(all, s => s.Text.Contains("</think>"));
    }

    [Fact]
    public void MultipleOrphanCloseTags_AllStripped()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "a</think>b</think>c");

        Assert.Equal("abc", ConcatText(all, thinking: false));
    }

    // ── Regular angle brackets in text ──

    [Fact]
    public void AngleBracketInText_NotConfusedWithTag()
    {
        var parser = new ThinkTagStreamParser();
        var all = Collect(parser, "a < b and c > d");

        var text = ConcatText(all, thinking: false);
        Assert.Equal("a < b and c > d", text);
        Assert.DoesNotContain(all, s => s.IsThinking);
    }

    [Fact]
    public void LessThanAtEndOfChunk_ReleasedOnNextChunk()
    {
        var parser = new ThinkTagStreamParser();
        var seg1 = parser.ProcessChunk("value is <");
        var seg2 = parser.ProcessChunk(" 10");
        var flushed = parser.Flush();
        var all = seg1.Concat(seg2).Concat(flushed).ToList();

        Assert.Equal("value is < 10", ConcatText(all, thinking: false));
    }

    // ── Flush behavior ──

    [Fact]
    public void FlushEmitsRemainingThinkBuffer()
    {
        var parser = new ThinkTagStreamParser();
        var segments = parser.ProcessChunk("<think>partial");
        var flushed = parser.Flush();
        var all = segments.Concat(flushed).ToList();

        Assert.Contains("partial", ConcatText(all, thinking: true));
    }

    [Fact]
    public void DoubleFlush_SecondIsEmpty()
    {
        var parser = new ThinkTagStreamParser();
        parser.ProcessChunk("hello");
        parser.Flush();
        var second = parser.Flush();

        Assert.Empty(second);
    }

    // ── Null / empty handling ──

    [Fact]
    public void NullChunk_ReturnsEmpty()
    {
        var parser = new ThinkTagStreamParser();
        Assert.Empty(parser.ProcessChunk(null));
    }

    [Fact]
    public void EmptyChunk_ReturnsEmpty()
    {
        var parser = new ThinkTagStreamParser();
        Assert.Empty(parser.ProcessChunk(""));
    }

    // ── Safety valve ──

    [Fact]
    public void SafetyValve_FlushesLargeUnterminatedThinkBlock()
    {
        var parser = new ThinkTagStreamParser();
        var largeContent = new string('x', 60_000);
        var seg1 = parser.ProcessChunk("<think>" + largeContent);
        // Safety valve should have triggered — content emitted as thinking
        var all = seg1.Concat(parser.Flush()).ToList();

        var thinking = ConcatText(all, thinking: true);
        Assert.Equal(60_000, thinking.Length);
    }

    // ── Helpers ──

    private static List<(string Text, bool IsThinking)> Collect(
        ThinkTagStreamParser parser,
        string input
    )
    {
        var segments = parser.ProcessChunk(input);
        var flushed = parser.Flush();
        return segments.Concat(flushed).ToList();
    }

    private static string ConcatText(
        IEnumerable<(string Text, bool IsThinking)> segments,
        bool thinking
    ) => string.Concat(segments.Where(s => s.IsThinking == thinking).Select(s => s.Text));
}
