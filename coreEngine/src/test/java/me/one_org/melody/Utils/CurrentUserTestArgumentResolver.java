package me.one_org.melody.Utils;

import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;
import me.one_org.melody.Security.CurrentUser;
import me.one_org.melody.Security.CustomUserDetails;

/**
 * Test argument resolver for standalone MockMvc setups that binds @CurrentUser / CustomUserDetails
 * from either the SecurityContextHolder or a request attribute named "userId".
 */
public class CurrentUserTestArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
                || CustomUserDetails.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails) {
            return userDetails;
        }

        String userId = (String) webRequest.getAttribute("userId", RequestAttributes.SCOPE_REQUEST);
        if (userId != null && !userId.isBlank()) {
            return new CustomUserDetails(userId, userId + "@melody.com", "TestUser", RoleEnum.USER, StatusEnum.ACTIVE);
        }

        return null;
    }
}
