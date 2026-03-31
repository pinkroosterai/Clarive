namespace Clarive.Domain.ValueObjects;

public record AiUsageCostResult(
    decimal? EstimatedInputCostUsd,
    decimal? EstimatedOutputCostUsd
);
