package me.one_org.melody.Security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import me.one_org.melody.Entity.UsersEntity;
import me.one_org.melody.Repository.UsersRepository;

/**
 * Spring Security UserDetailsService implementation to load user records
 * by email, username, or id from UsersRepository.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UsersRepository usersRepository;

    public CustomUserDetailsService(UsersRepository usersRepository) {
        this.usersRepository = usersRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        UsersEntity user = usersRepository.findByEmail(identifier)
                .or(() -> usersRepository.findById(identifier))
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email or id: " + identifier));

        return new CustomUserDetails(user);
    }

    public CustomUserDetails loadUserById(String id) throws UsernameNotFoundException {
        UsersEntity user = usersRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + id));

        return new CustomUserDetails(user);
    }
}
