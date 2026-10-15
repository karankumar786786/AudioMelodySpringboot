package me.one_org.melody.Dto.AlgoliaSearch;

public record AlgoliaClientConfigDto(
    String appId,
    String indexName,
    String apiKey
) {}
