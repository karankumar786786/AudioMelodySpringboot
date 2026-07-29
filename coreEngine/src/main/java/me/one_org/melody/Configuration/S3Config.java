package me.one_org.melody.Configuration;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {
    @Value("${aws.accesskeyid}")
    private String accessKeyId;
    @Value("${aws.secretkey}")
    private String secretAccessKey;
    @Value("${aws.region}")
    private String region;
    @Value("${aws.endpoint}")
    private String endpoint;

    @Bean
    public S3Client s3Client(){
        S3ClientBuilder builder = S3Client.builder()
        .region(Region.of(region))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKeyId, secretAccessKey)
            )
        );
        if (!endpoint.isEmpty()) {
            builder.endpointOverride(URI.create(endpoint));
        };
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner(){
        S3Presigner.Builder builder = S3Presigner.builder()
        .region(Region.of(region))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKeyId, secretAccessKey)
            )
        );
        if (!endpoint.isEmpty()) {
            builder.endpointOverride(URI.create(endpoint));
        };
        return builder.build();
    }
}
