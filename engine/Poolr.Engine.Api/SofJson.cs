using System.Text.Json;
using System.Text.Json.Serialization;

namespace Poolr.Engine.Api;

/// <summary>JSON options preserving original property casing (camelCase fields in C# models).</summary>
public static class SofJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        IncludeFields = true,
    };
}
