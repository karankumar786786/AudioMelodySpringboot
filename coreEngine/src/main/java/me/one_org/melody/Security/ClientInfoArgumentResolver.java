package me.one_org.melody.Security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import jakarta.servlet.http.HttpServletRequest;
import me.one_org.melody.Dto.Internal.ClientInfo;
import me.one_org.melody.Services.General.GeoIpService;
import me.one_org.melody.Utils.ClientInfoExtractor;

@Component
public class ClientInfoArgumentResolver implements HandlerMethodArgumentResolver {

    private final GeoIpService geoIpService;

    @Autowired
    public ClientInfoArgumentResolver(GeoIpService geoIpService) {
        this.geoIpService = geoIpService;
    }

    public ClientInfoArgumentResolver() {
        this(null);
    }

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

        String cityHeader = ClientInfoExtractor.getHeaderOrNull(request, "CF-IPCity", "X-Geo-City");
        String countryHeader = ClientInfoExtractor.getHeaderOrNull(request, "CF-IPCountry", "X-Geo-Country", "X-Country");

        String location = geoIpService != null
                ? geoIpService.resolveLocation(ipAddress, cityHeader, countryHeader)
                : "Unknown Location";

        return new ClientInfo(ipAddress, userAgent != null ? userAgent : "", deviceName, location);
    }
}
