package com.chefgame.service;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.bean.WxMaJscode2SessionResult;
import cn.hutool.core.util.IdUtil;
import com.chefgame.common.GameException;
import com.chefgame.dto.request.LoginRequest;
import com.chefgame.dto.response.LoginResponse;
import com.chefgame.dto.response.UserInfoResponse;
import com.chefgame.entity.BoardState;
import com.chefgame.entity.Restaurant;
import com.chefgame.entity.User;
import com.chefgame.repository.BoardRepository;
import com.chefgame.repository.RestaurantRepository;
import com.chefgame.repository.UserRepository;
import com.chefgame.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 用户服务 — 微信登录、JWT 签发、用户信息管理
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BoardRepository boardRepository;
    private final RestaurantRepository restaurantRepository;
    private final WxMaService wxMaService;
    private final JwtUtil jwtUtil;

    @Value("${game.energy-max:100}")
    private int energyMax;

    /**
     * 微信静默登录
     * wx.login code → openid → 查询/创建用户 → JWT签发
     */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        // 1. 通过 wx.login code 换取 openid
        String openid;
        try {
            WxMaJscode2SessionResult session = wxMaService.getUserService()
                    .getSessionInfo(request.getCode());
            openid = session.getOpenid();
            log.info("微信登录: openid={}", maskOpenid(openid));
        } catch (Exception e) {
            log.error("微信 code2session 失败", e);
            throw new GameException(10001, "微信登录失败，请重试");
        }

        // 2. 查询或创建用户
        Optional<User> existing = userRepository.findByOpenid(openid);
        boolean isNewUser = existing.isEmpty();

        User user;
        if (isNewUser) {
            user = createNewUser(openid, request);
        } else {
            user = existing.get();
            // 更新昵称和头像（如有传入）
            if (request.getNickName() != null && !request.getNickName().isBlank()) {
                user.setNickName(request.getNickName());
            }
            if (request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()) {
                user.setAvatarUrl(request.getAvatarUrl());
            }
            userRepository.save(user);
        }

        // 3. 签发 JWT
        String token = jwtUtil.createToken(user.getUid());
        log.info("JWT 签发成功: uid={}, isNewUser={}", user.getUid(), isNewUser);

        // 4. 构建响应
        LoginResponse.UserBrief userBrief = LoginResponse.UserBrief.builder()
                .uid(user.getUid())
                .nickName(user.getNickName())
                .avatarUrl(user.getAvatarUrl())
                .isNewUser(isNewUser)
                .gold(user.getGold())
                .energy(user.getEnergy())
                .restaurantLevel(user.getRestaurantLevel())
                .rating(user.getRating())
                .build();

        return LoginResponse.builder()
                .token(token)
                .user(userBrief)
                .build();
    }

    /**
     * 创建新用户
     */
    private User createNewUser(String openid, LoginRequest request) {
        String uid = "u_" + IdUtil.getSnowflake(1, 1).nextIdStr();
        long now = System.currentTimeMillis();

        User user = User.builder()
                .uid(uid)
                .openid(openid)
                .nickName(request.getNickName() != null ? request.getNickName() : "小厨神" + uid.substring(uid.length() - 4))
                .avatarUrl(request.getAvatarUrl())
                .gold(100)
                .energy(energyMax)
                .energyTs(now)
                .rating(new BigDecimal("3.0"))
                .restaurantLevel(1)
                .isNewUser(true)
                .build();
        userRepository.save(user);

        // 初始化棋盘
        String emptyBoard = buildEmptyBoard(6, 5);
        BoardState board = BoardState.builder()
                .uid(uid)
                .cells(emptyBoard)
                .rows(6)
                .cols(5)
                .version(0)
                .build();
        boardRepository.save(board);

        // 初始化餐厅
        Restaurant restaurant = Restaurant.builder()
                .uid(uid)
                .level(1)
                .name("街边小摊")
                .build();
        restaurantRepository.save(restaurant);

        log.info("新用户注册成功: uid={}", uid);
        return user;
    }

    /**
     * 构建空棋盘 JSON
     */
    private String buildEmptyBoard(int rows, int cols) {
        StringBuilder sb = new StringBuilder("[");
        int total = rows * cols;
        for (int i = 0; i < total; i++) {
            if (i > 0) sb.append(",");
            sb.append("null");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 获取用户信息
     */
    public UserInfoResponse getUserInfo(String uid) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        Restaurant restaurant = restaurantRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "餐厅信息不存在"));

        return UserInfoResponse.builder()
                .uid(user.getUid())
                .nickName(user.getNickName())
                .avatarUrl(user.getAvatarUrl())
                .gold(user.getGold())
                .energy(user.getEnergy())
                .rating(user.getRating())
                .restaurantLevel(user.getRestaurantLevel())
                .restaurantName(restaurant.getName())
                .isNewUser(user.getIsNewUser())
                .build();
    }

    /**
     * 更新用户信息
     */
    @Transactional
    public UserInfoResponse updateUserInfo(String uid, String nickName, String avatarUrl) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        if (nickName != null && !nickName.isBlank()) {
            user.setNickName(nickName);
        }
        if (avatarUrl != null && !avatarUrl.isBlank()) {
            user.setAvatarUrl(avatarUrl);
        }
        userRepository.save(user);

        return getUserInfo(uid);
    }

    /**
     * 批量获取用户简要信息（用于排行榜）
     */
    public Map<String, UserInfoResponse> getUserBriefMap(List<String> uids) {
        return userRepository.findByUidIn(uids).stream()
                .map(u -> UserInfoResponse.builder()
                        .uid(u.getUid())
                        .nickName(u.getNickName())
                        .avatarUrl(u.getAvatarUrl())
                        .restaurantLevel(u.getRestaurantLevel())
                        .rating(u.getRating())
                        .build())
                .collect(Collectors.toMap(UserInfoResponse::getUid, Function.identity()));
    }

    /**
     * openid 脱敏
     */
    private String maskOpenid(String openid) {
        if (openid == null || openid.length() <= 8) return "***";
        return openid.substring(0, 4) + "****" + openid.substring(openid.length() - 4);
    }
}
