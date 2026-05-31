package com.chefgame.service;

import com.chefgame.common.GameException;
import com.chefgame.dto.response.SocialResponse;
import com.chefgame.entity.BoardState;
import com.chefgame.entity.Restaurant;
import com.chefgame.entity.SocialVisit;
import com.chefgame.entity.User;
import com.chefgame.repository.BoardRepository;
import com.chefgame.repository.RestaurantRepository;
import com.chefgame.repository.SocialVisitRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 社交服务 — 好友拜访、点赞、能量赠礼
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialService {

    private final UserRepository userRepository;
    private final SocialVisitRepository socialVisitRepository;
    private final BoardRepository boardRepository;
    private final RestaurantRepository restaurantRepository;
    private final StringRedisTemplate stringRedisTemplate;

    @Value("${game.visit-daily-limit:10}")
    private int visitDailyLimit;

    @Value("${game.gift-daily-limit:5}")
    private int giftDailyLimit;

    private static final String VISIT_COUNT_KEY = "visit:count:";
    private static final String GIFT_COUNT_KEY = "gift:count:";

    /**
     * 获取好友列表（模拟，实际需接入微信关系链）
     */
    public SocialResponse getFriends(String uid) {
        // V1.0 模拟好友列表（实际需通过微信关系链获取）
        List<User> allUsers = userRepository.findAll();
        List<SocialResponse.FriendBrief> friends = allUsers.stream()
                .filter(u -> !u.getUid().equals(uid))
                .limit(20)
                .map(u -> SocialResponse.FriendBrief.builder()
                        .uid(u.getUid())
                        .nickName(u.getNickName())
                        .avatarUrl(u.getAvatarUrl())
                        .restaurantLevel(u.getRestaurantLevel())
                        .rating(u.getRating())
                        .build())
                .collect(Collectors.toList());

        // 当日拜访计数
        long todayCount = getTodayVisitCount(uid);

        return SocialResponse.builder()
                .friends(friends)
                .dailyVisitCount(todayCount)
                .dailyVisitLimit(visitDailyLimit)
                .build();
    }

    /**
     * 查看好友餐厅
     */
    public SocialResponse getFriendRestaurant(String uid, String friendUid) {
        User friend = userRepository.findByUid(friendUid)
                .orElseThrow(() -> new GameException(14001, "该好友不存在"));

        Restaurant restaurant = restaurantRepository.findByUid(friendUid)
                .orElseThrow(() -> new GameException(14001, "好友餐厅信息不存在"));

        BoardState board = boardRepository.findByUid(friendUid)
                .orElse(null);

        long likeCount = socialVisitRepository.countByHostUidAndLikedTrue(friendUid);

        // 检查今日是否已点赞
        boolean likedToday = hasLikedToday(uid, friendUid);

        return SocialResponse.builder()
                .friendRestaurant(SocialResponse.FriendRestaurant.builder()
                        .uid(friend.getUid())
                        .nickName(friend.getNickName())
                        .restaurantName(restaurant.getName())
                        .level(restaurant.getLevel())
                        .rating(friend.getRating())
                        .likeCount(likeCount)
                        .cells(board != null ? board.getCells() : "[]")
                        .rows(board != null ? board.getRows() : 6)
                        .cols(board != null ? board.getCols() : 5)
                        .likedToday(likedToday)
                        .build())
                .build();
    }

    /**
     * 拜访好友餐厅
     */
    @Transactional
    public SocialResponse visitFriend(String uid, String friendUid) {
        if (uid.equals(friendUid)) {
            throw new GameException(14002, "不能拜访自己的餐厅哦");
        }

        // 校验好友是否存在
        userRepository.findByUid(friendUid)
                .orElseThrow(() -> new GameException(14001, "该好友不存在"));

        // 校验每日拜访上限
        long todayCount = getTodayVisitCount(uid);
        if (todayCount >= visitDailyLimit) {
            throw new GameException(14003, "今日拜访次数已用完（每日上限" + visitDailyLimit + "次）");
        }

        // 校验今日是否已拜访过该好友
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        long countToHost = socialVisitRepository.countTodayVisitToHost(uid, friendUid, todayStart);
        if (countToHost > 0) {
            throw new GameException(14004, "今日已拜访过该好友，明天再来吧");
        }

        // 记录拜访
        SocialVisit visit = SocialVisit.builder()
                .visitorUid(uid)
                .hostUid(friendUid)
                .liked(false)
                .build();
        socialVisitRepository.save(visit);

        // 更新 Redis 计数
        String key = VISIT_COUNT_KEY + uid + ":" + LocalDate.now();
        stringRedisTemplate.opsForValue().increment(key);
        stringRedisTemplate.expire(key, 1, TimeUnit.DAYS);

        // 获得灵感值（固定1点）
        int inspiration = 1;

        log.info("好友拜访: visitor={}, host={}", uid, friendUid);

        return SocialResponse.builder()
                .visitResult(SocialResponse.VisitResult.builder()
                        .inspirationGained(inspiration)
                        .liked(false)
                        .build())
                .build();
    }

    /**
     * 给好友点赞
     */
    @Transactional
    public SocialResponse likeFriend(String uid, String friendUid) {
        if (uid.equals(friendUid)) {
            throw new GameException(14002, "不能给自己点赞哦");
        }

        // 查找今日拜访记录
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        long visitCount = socialVisitRepository.countTodayVisitToHost(uid, friendUid, todayStart);
        if (visitCount == 0) {
            throw new GameException(14005, "需要先拜访好友才能点赞哦");
        }

        // 检查是否已点赞
        if (hasLikedToday(uid, friendUid)) {
            throw new GameException(14006, "今日已点过赞了");
        }

        // 创建点赞记录
        SocialVisit like = SocialVisit.builder()
                .visitorUid(uid)
                .hostUid(friendUid)
                .liked(true)
                .build();
        socialVisitRepository.save(like);

        log.info("好友点赞: visitor={}, host={}", uid, friendUid);

        return SocialResponse.builder()
                .visitResult(SocialResponse.VisitResult.builder()
                        .inspirationGained(0)
                        .liked(true)
                        .build())
                .build();
    }

    /**
     * 赠送能量给好友
     */
    @Transactional
    public void giftEnergy(String uid, String friendUid) {
        if (uid.equals(friendUid)) {
            throw new GameException(14002, "不能给自己送能量哦");
        }

        // 校验好友是否存在
        userRepository.findByUid(friendUid)
                .orElseThrow(() -> new GameException(14001, "该好友不存在"));

        // 校验每日赠送上限
        String key = GIFT_COUNT_KEY + uid + ":" + LocalDate.now();
        String countStr = stringRedisTemplate.opsForValue().get(key);
        long count = countStr != null ? Long.parseLong(countStr) : 0;
        if (count >= giftDailyLimit) {
            throw new GameException(14007, "今日赠送次数已用完（每日上限" + giftDailyLimit + "次）");
        }

        // 赠送 10 点能量给好友
        User friend = userRepository.findByUid(friendUid).get();
        int newEnergy = Math.min(100, friend.getEnergy() + 10);
        friend.setEnergy(newEnergy);
        friend.setEnergyTs(System.currentTimeMillis());
        userRepository.save(friend);

        // 更新计数
        stringRedisTemplate.opsForValue().increment(key);
        stringRedisTemplate.expire(key, 1, TimeUnit.DAYS);

        log.info("能量赠送: from={}, to={}, amount=10", uid, friendUid);
    }

    /**
     * 获取收到的能量赠礼列表
     */
    public SocialResponse getEnergyGifts(String uid) {
        // V1.0 简化实现：无赠礼列表，仅为 API 预留
        return SocialResponse.builder()
                .energyGifts(new ArrayList<>())
                .build();
    }

    /**
     * 获取今日拜访次数
     */
    private long getTodayVisitCount(String uid) {
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        return socialVisitRepository.countTodayVisits(uid, todayStart);
    }

    /**
     * 检查今日是否已点赞
     */
    private boolean hasLikedToday(String visitorUid, String hostUid) {
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        long count = socialVisitRepository.countTodayVisitToHost(visitorUid, hostUid, todayStart);
        // 最后一次拜访是否已点赞
        return count > 0 && socialVisitRepository.countByHostUidAndLikedTrue(hostUid) > 0;
    }
}
