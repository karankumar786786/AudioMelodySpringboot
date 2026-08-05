package me.one_org.melody.Exceptions;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Error.ErrorResponseDto;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

        @ExceptionHandler(BaseException.class)
        public ResponseEntity<ErrorResponseDto> handleBaseException(BaseException ex, WebRequest request) {
                String path = getPath(request);
                log.warn("Business Exception [{}]: {} at path {}", ex.getStatus(), ex.getMessage(), path);
                ErrorResponseDto response = new ErrorResponseDto(
                                ex.getStatus().value(),
                                ex.getStatus().getReasonPhrase(),
                                ex.getMessage(),
                                path);
                return new ResponseEntity<>(response, ex.getStatus());
        }

        @ExceptionHandler(ResponseStatusException.class)
        public ResponseEntity<ErrorResponseDto> handleResponseStatusException(ResponseStatusException ex,
                        WebRequest request) {
                String path = getPath(request);
                HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
                log.warn("ResponseStatusException [{}]: {} at path {}", status, ex.getReason(), path);
                ErrorResponseDto response = new ErrorResponseDto(
                                status.value(),
                                status.getReasonPhrase(),
                                ex.getReason() != null ? ex.getReason() : ex.getMessage(),
                                path);
                return new ResponseEntity<>(response, status);
        }

        @ExceptionHandler({ NoResourceFoundException.class, NoHandlerFoundException.class,
                        EntityNotFoundException.class })
        public ResponseEntity<ErrorResponseDto> handleNotFoundException(Exception ex, WebRequest request) {
                String path = getPath(request);
                log.warn("Path or Resource not found at path {}: {}", path, ex.getMessage());
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.NOT_FOUND.value(),
                                HttpStatus.NOT_FOUND.getReasonPhrase(),
                                "Requested path or resource not found: " + path,
                                path);
                return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
        }

        @SuppressWarnings("null")
        @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
        public ResponseEntity<ErrorResponseDto> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex,
                        WebRequest request) {
                String path = getPath(request);
                List<String> supportedMethods = ex.getSupportedHttpMethods() != null
                                ? ex.getSupportedHttpMethods().stream().map(org.springframework.http.HttpMethod::name).toList()
                                : List.of();
                String message = String.format("HTTP method '%s' is not supported for this endpoint", ex.getMethod());
                List<String> details = supportedMethods.isEmpty()
                                ? List.of("No supported HTTP methods identified for this path")
                                : List.of("Supported HTTP methods: " + String.join(", ", supportedMethods));

                log.warn("Method not allowed at path {}: {}", path, message);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.METHOD_NOT_ALLOWED.value(),
                                HttpStatus.METHOD_NOT_ALLOWED.getReasonPhrase(),
                                message,
                                path,
                                details);
                return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                                .allow(ex.getSupportedHttpMethods() != null 
                                        ? ex.getSupportedHttpMethods().toArray(org.springframework.http.HttpMethod[]::new) 
                                        : new org.springframework.http.HttpMethod[0])
                                .body(response);
        }

        @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
        public ResponseEntity<ErrorResponseDto> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex,
                        WebRequest request) {
                String path = getPath(request);
                String message = String.format("Content-Type '%s' is not supported", ex.getContentType());
                List<String> details = List.of("Supported media types: " + ex.getSupportedMediaTypes());
                log.warn("Unsupported media type at path {}: {}", path, message);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(),
                                HttpStatus.UNSUPPORTED_MEDIA_TYPE.getReasonPhrase(),
                                message,
                                path,
                                details);
                return new ResponseEntity<>(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }

        @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
        public ResponseEntity<ErrorResponseDto> handleMediaTypeNotAcceptable(HttpMediaTypeNotAcceptableException ex,
                        WebRequest request) {
                String path = getPath(request);
                log.warn("Media type not acceptable at path {}: {}", path, ex.getMessage());
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.NOT_ACCEPTABLE.value(),
                                HttpStatus.NOT_ACCEPTABLE.getReasonPhrase(),
                                "Requested media type is not acceptable",
                                path);
                return new ResponseEntity<>(response, HttpStatus.NOT_ACCEPTABLE);
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ErrorResponseDto> handleValidationException(MethodArgumentNotValidException ex,
                        WebRequest request) {
                String path = getPath(request);
                List<String> details = ex.getBindingResult().getFieldErrors().stream()
                                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                                .toList();
                log.warn("Validation failed for request at path {}: {}", path, details);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                "Validation failed for request parameters",
                                path,
                                details);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(ConstraintViolationException.class)
        public ResponseEntity<ErrorResponseDto> handleConstraintViolation(ConstraintViolationException ex,
                        WebRequest request) {
                String path = getPath(request);
                List<String> details = ex.getConstraintViolations().stream()
                                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                                .toList();
                log.warn("Constraint violation at path {}: {}", path, details);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                "Validation failed for request parameters",
                                path,
                                details);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(HandlerMethodValidationException.class)
        public ResponseEntity<ErrorResponseDto> handleMethodValidation(HandlerMethodValidationException ex,
                        WebRequest request) {
                String path = getPath(request);
                List<String> details = ex.getAllErrors().stream()
                                .map(err -> (err instanceof org.springframework.validation.FieldError fe)
                                                ? fe.getField() + ": " + err.getDefaultMessage()
                                                : err.getDefaultMessage())
                                .toList();
                log.warn("Handler method validation failed at path {}: {}", path, details);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                "Validation failed for method parameters",
                                path,
                                details);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(MissingServletRequestParameterException.class)
        public ResponseEntity<ErrorResponseDto> handleMissingParam(MissingServletRequestParameterException ex,
                        WebRequest request) {
                String path = getPath(request);
                String message = String.format("Required request parameter '%s' of type %s is missing",
                                ex.getParameterName(), ex.getParameterType());
                log.warn("Missing request parameter at path {}: {}", path, message);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                message,
                                path);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(MethodArgumentTypeMismatchException.class)
        public ResponseEntity<ErrorResponseDto> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                        WebRequest request) {
                String path = getPath(request);
                String requiredType = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown";
                String message = String.format("Parameter '%s' should be of type %s", ex.getName(), requiredType);
                log.warn("Method argument type mismatch at path {}: {}", path, message);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                message,
                                path);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(HttpMessageNotReadableException.class)
        public ResponseEntity<ErrorResponseDto> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
                        WebRequest request) {
                String path = getPath(request);
                log.warn("Malformed JSON request at path {}: {}", path, ex.getMessage());
                String message = "Malformed JSON request body or unparseable payload";
                String detail = ex.getMessage();

                if (detail != null && detail.contains("Required request body is missing")) {
                        message = "Required request body is missing";
                        detail = "Request body is missing. Please provide the required JSON payload in the request body.";
                } else if (detail != null && detail.contains(":")) {
                        // Extract concise Jackson parsing error message if available
                        detail = detail.split(":")[0];
                }

                List<String> details = detail != null ? List.of(detail) : null;
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                message,
                                path,
                                details);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<ErrorResponseDto> handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
                String path = getPath(request);
                log.warn("Illegal argument at path {}: {}", path, ex.getMessage());
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                ex.getMessage(),
                                path);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(ServletRequestBindingException.class)
        public ResponseEntity<ErrorResponseDto> handleRequestBindingException(ServletRequestBindingException ex,
                        WebRequest request) {
                String path = getPath(request);
                log.warn("Request binding error at path {}: {}", path, ex.getMessage());
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.BAD_REQUEST.value(),
                                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                                ex.getMessage(),
                                path);
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ErrorResponseDto> handleUncaughtException(Exception ex, WebRequest request) {
                String path = getPath(request);
                log.error("Unhandled Exception at path {}: {}", path, ex.getMessage(), ex);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                                "An unexpected internal server error occurred",
                                path);
                return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        private String getPath(WebRequest request) {
                if (request instanceof ServletWebRequest servletWebRequest) {
                        return servletWebRequest.getRequest().getRequestURI();
                }
                return "";
        }
}
