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
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Error.ErrorResponseDto;

/**
 * Poore core API ka ek central error handler.
 *
 * Koi bhi controller/service exception phenke, to Spring yahan aata hai aur exception ke
 * type ke hisaab se sahi method chalata hai. Har method ek hi format ka JSON bhejta hai
 * (ErrorResponseDto: status, error, message, path, details), taaki app ko har error ek
 * jaisa dikhe.
 *
 * Jis exception ka koi specific handler nahi hai, wo last wale handleUncaughtException
 * me jaata hai -> 500, aur user ko andar ki detail nahi dikhayi jaati (security ke liye).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

        /** Hamare apne errors (BadRequest, NotFound, Conflict...) - status exception me hi hai. */
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

        /** Spring ka ResponseStatusException (kisi ne seedha status ke saath throw kiya). */
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

        /** 404: URL hi galat hai, ya JPA ko entity nahi mili. */
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

        /**
         * 405: URL sahi hai par method galat (jaise POST chahiye tha, GET bheja).
         * Response ke "Allow" header me batate hain ki kaunse methods chalte hain.
         */
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

        /** 415: body ka Content-Type support nahi (jaise JSON ki jagah form data bheja). */
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

        /** 406: client ne Accept header me aisa format maanga jo hum de nahi sakte. */
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

        /** 400: @Valid body ke fields check fail hue - har galat field ka message details me. */
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

        /** 400: path/query params pe lage validation rules fail hue (jaise @Min, @Size). */
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

        /** 400: method parameters ka validation fail (Spring ka naya validation style). */
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

        /** 400: zaroori query parameter bheja hi nahi. */
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

        /** 400: parameter ka type galat (jaise page=abc, jabki number chahiye tha). */
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

        /** 400: body JSON hi nahi ban paa rahi (toota JSON, ya body bheji hi nahi). */
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
                        // Jackson ka error bahut lamba hota hai - ":" se pehle wala chhota hissa hi rakho
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

        /** 400: code me kisi ne IllegalArgumentException phenka (galat input). */
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

        /** 400: zaroori header / cookie / path variable nahi mila. */
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

        @ExceptionHandler(AsyncRequestNotUsableException.class)
        public void handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex, WebRequest request) {
                // User ne SSE / async request ke beech me tab band ya refresh kar diya.
                // Connection pehle hi band hai, to error response likhne ki koshish bekaar hai - bas debug log.
                log.debug("Async/SSE client disconnected at path {}: {}", getPath(request), ex.getMessage());
        }

        /**
         * Baaki saare errors (jinka upar koi handler nahi) -> 500.
         * Poora stack trace log hota hai, par user ko sirf generic message jaata hai.
         * Agar client ne connection hi tod diya tha, to kuch nahi bhejte (null).
         */
        @ExceptionHandler(Exception.class)
        public ResponseEntity<ErrorResponseDto> handleUncaughtException(Exception ex, WebRequest request) {
                String path = getPath(request);
                if (isClientDisconnect(ex)) {
                        log.debug("Client connection terminated at path {}: {}", path, ex.getMessage());
                        return null;
                }
                log.error("Unhandled Exception at path {}: {}", path, ex.getMessage(), ex);
                ErrorResponseDto response = new ErrorResponseDto(
                                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                                "An unexpected internal server error occurred",
                                path);
                return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        /** Exception (ya uske andar ka cause) "client chala gaya" wala hai? Broken pipe / connection reset. */
        private boolean isClientDisconnect(Throwable ex) {
                while (ex != null) {
                        String msg = ex.getMessage();
                        if (ex instanceof AsyncRequestNotUsableException ||
                            (msg != null && (msg.contains("Broken pipe") || msg.contains("Connection reset by peer")))) {
                                return true;
                        }
                        ex = ex.getCause();
                }
                return false;
        }

        /** Kis URL pe error aaya - response aur logs me dikhane ke liye. */
        private String getPath(WebRequest request) {
                if (request instanceof ServletWebRequest servletWebRequest) {
                        return servletWebRequest.getRequest().getRequestURI();
                }
                return "";
        }
}
