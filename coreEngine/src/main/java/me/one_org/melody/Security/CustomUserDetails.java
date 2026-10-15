package me.one_org.melody.Security;

import java.util.Collection;
import java.util.Collections;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import me.one_org.melody.Dto.Internal.JwtPayloadDto;
import me.one_org.melody.Entity.User;
import me.one_org.melody.Enums.RoleEnum;
import me.one_org.melody.Enums.StatusEnum;

/**
 * Clean Spring Security UserDetails implementation representing an authenticated user.
 * Contains no Jackson annotations (@JsonIgnore) or serialization leaks.
 */
public class CustomUserDetails implements UserDetails {

    private static final long serialVersionUID = 1L;

    private final String id;
    private final String email;
    private final String userName;
    private final RoleEnum role;
    private final StatusEnum status;
    private final Collection<? extends GrantedAuthority> authorities;
    private transient User user;

    public CustomUserDetails(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.userName = user.getUserName() != null ? user.getUserName() : user.getEmail();
        this.role = user.getRole();
        this.status = user.getStatus() != null ? user.getStatus() : StatusEnum.ACTIVE;
        this.authorities = user.getRole() != null
                ? List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
                : Collections.emptyList();
        this.user = user;
    }

    public CustomUserDetails(JwtPayloadDto jwtPayload) {
        this.id = jwtPayload.id();
        this.email = jwtPayload.email();
        this.userName = jwtPayload.userName() != null ? jwtPayload.userName() : jwtPayload.email();
        this.role = jwtPayload.role() != null ? jwtPayload.role() : RoleEnum.USER;
        this.status = StatusEnum.ACTIVE;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + this.role.name()));
        this.user = null;
    }

    public CustomUserDetails(String id, String email, String userName, RoleEnum role, StatusEnum status) {
        this.id = id;
        this.email = email;
        this.userName = userName != null ? userName : email;
        this.role = role != null ? role : RoleEnum.USER;
        this.status = status != null ? status : StatusEnum.ACTIVE;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + this.role.name()));
        this.user = null;
    }

    public String getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getUserName() {
        return userName;
    }

    public RoleEnum getRole() {
        return role;
    }

    public StatusEnum getStatus() {
        return status;
    }

    public User getUser() {
        return user;
    }

    public JwtPayloadDto toJwtPayload() {
        return new JwtPayloadDto(id, userName, email, role);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email != null ? email : id;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return status != StatusEnum.BLOCKED;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status == StatusEnum.ACTIVE;
    }
}
