package me.one_org.melody.Security;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import jakarta.servlet.http.HttpServletRequest;
import me.one_org.melody.Dto.Internal.ClientInfo;
import me.one_org.melody.Utils.ClientInfoExtractor;

@Component
public class ClientInfoArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return ClientInfo.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            return ClientInfo.fallback();
        }
        String ipAddress = ClientInfoExtractor.getClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        String deviceName = ClientInfoExtractor.parseDeviceName(userAgent);
        return new ClientInfo(ipAddress, userAgent != null ? userAgent : "", deviceName);
    }
}
