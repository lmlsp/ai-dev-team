package com.chefgame.service;

import com.chefgame.dto.response.LeaderboardResponse;
import com.chefgame.dto.response.UserInfoResponse;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 排行榜服务 — Redis Sorted Set 排行榜读写
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final StringRedisTemplate stringRedisTemplate;
    private final UserRepository userRepository;

    private static final String WEEKLY_KEY_PREFIX = "lb:weekly:";
    private static final String TOTAL_KEY = "lb:total";
    private static final long MAX_LEADERBOARD_SIZE = 100_000;

    /**
     * 更新用户排行榜分数
     * @param uid 用户UID
     * @param rating 好评度
     * @param restaurantLevel 餐厅等级
     */
    public void updateScore(String uid, double rating, int restaurantLevel) {
        // 周榜：按好评度排序
        String weekKey = WEEKLY_KEY_PREFIX + getCurrentWeekKey();
        stringRedisTemplate.opsForZSet().add(weekKey, uid, rating);
        // 裁剪：仅保留前 MAX_LEADERBOARD_SIZE 名
        Long weekSize = stringRedisTemplate.opsForZSet().zCard(weekKey);
        if (weekSize != null && weekSize > MAX_LEADERBOARD_SIZE) {
            stringRedisTemplate.opsForZSet().removeRange(weekKey, 0,
                    weekSize - MAX_LEADERBOARD_SIZE - 1);
        }

        // 总榜：level加权，score = level * 1000 + rating
        double totalScore = restaurantLevel * 1000 + rating;
        stringRedisTemplate.opsForZSet().add(TOTAL_KEY, uid, totalScore);
        // 裁剪：仅保留前 MAX_LEADERBOARD_SIZE 名
        Long totalSize = stringRedisTemplate.opsForZSet().zCard(TOTAL_KEY);
        if (totalSize != null && totalSize > MAX_LEADERBOARD_SIZE) {
            stringRedisTemplate.opsForZSet().removeRange(TOTAL_KEY, 0,
                    totalSize - MAX_LEADERBOARD_SIZE - 1);
        }
    }

    /**
     * 查询周排行榜
     */
    public LeaderboardResponse getWeeklyRanking(int page, int size, String myUid) {
        String weekKey = WEEKLY_KEY_PREFIX + getCurrentWeekKey();
        return getRanking(weekKey, page, size, myUid, "weekly");
    }

    /**
     * 查询总排行榜
     */
    public LeaderboardResponse getTotalRanking(int page, int size, String myUid) {
        return getRanking(TOTAL_KEY, page, size, myUid, "total");
    }

    /**
     * 通用排行榜查询
     */
    private LeaderboardResponse getRanking(String key, int page, int size,
                                            String myUid, String type) {
        long start = (long) (page - 1) * size;
        long end = start + size - 1;

        // ZREVRANGE 获取排名（降序）
        Set<ZSetOperations.TypedTuple<String>> topUsers =
                stringRedisTemplate.opsForZSet().reverseRangeWithScores(key, start, end);

        // 我的排名
        Long myRank = stringRedisTemplate.opsForZSet().reverseRank(key, myUid);

        // 总人数
        Long total = stringRedisTemplate.opsForZSet().zCard(key);
        if (total == null) total = 0L;

        // 批量查用户信息
        List<LeaderboardResponse.RankItem> list = new ArrayList<>();
        if (topUsers != null && !topUsers.isEmpty()) {
            List<String> uids = topUsers.stream()
                    .map(ZSetOperations.TypedTuple::getValue)
                    .collect(Collectors.toList());

            Map<String, com.chefgame.entity.User> userMap = userRepository.findByUidIn(uids).stream()
                    .collect(Collectors.toMap(com.chefgame.entity.User::getUid, u -> u));

            int rankBase = (int) start + 1;
            int i = 0;
            for (ZSetOperations.TypedTuple<String> item : topUsers) {
                String itemUid = item.getValue();
                Double score = item.getScore();
                com.chefgame.entity.User user = userMap.get(itemUid);
                if (user != null) {
                    list.add(LeaderboardResponse.RankItem.builder()
                            .rank(rankBase + i)
                            .uid(user.getUid())
                            .nickName(user.getNickName())
                            .avatarUrl(user.getAvatarUrl())
                            .restaurantName(getRestaurantName(user.getRestaurantLevel()))
                            .restaurantLevel(user.getRestaurantLevel())
                            .rating(user.getRating())
                            .build());
                }
                i++;
            }
        }

        // 构建我的排名
        LeaderboardResponse.MyRank myRankInfo = null;
        if (myRank != null) {
            var myUser = userRepository.findByUid(myUid).orElse(null);
            if (myUser != null) {
                myRankInfo = LeaderboardResponse.MyRank.builder()
                        .rank(myRank.intValue() + 1)
                        .rating(myUser.getRating())
                        .restaurantLevel(myUser.getRestaurantLevel())
                        .build();
            }
        }

        return LeaderboardResponse.builder()
                .list(list)
                .myRank(myRankInfo)
                .total(total)
                .build();
    }

    /**
     * 获取我的排名
     */
    public LeaderboardResponse getMyRank(String myUid, String type) {
        String key = "weekly".equals(type)
                ? WEEKLY_KEY_PREFIX + getCurrentWeekKey()
                : TOTAL_KEY;

        Long myRank = stringRedisTemplate.opsForZSet().reverseRank(key, myUid);
        Long total = stringRedisTemplate.opsForZSet().zCard(key);
        if (total == null) total = 0L;

        var myUser = userRepository.findByUid(myUid).orElse(null);
        LeaderboardResponse.MyRank myRankInfo = null;
        if (myUser != null && myRank != null) {
            myRankInfo = LeaderboardResponse.MyRank.builder()
                    .rank(myRank.intValue() + 1)
                    .rating(myUser.getRating())
                    .restaurantLevel(myUser.getRestaurantLevel())
                    .build();
        }

        return LeaderboardResponse.builder()
                .myRank(myRankInfo)
                .total(total)
                .build();
    }

    /**
     * 每周一凌晨重置周榜
     */
    @Scheduled(cron = "0 3 0 * * MON")
    public void resetWeeklyLeaderboard() {
        String lastWeekKey = WEEKLY_KEY_PREFIX + getLastWeekKey();
        Boolean deleted = stringRedisTemplate.delete(lastWeekKey);
        log.info("周榜重置: key={}, deleted={}", lastWeekKey, deleted);
    }

    /**
     * 获取当前周标识（如 2026-W22）
     */
    private String getCurrentWeekKey() {
        LocalDate now = LocalDate.now();
        WeekFields weekFields = WeekFields.ISO;
        int weekOfYear = now.get(weekFields.weekOfWeekBasedYear());
        return String.format("%d-W%02d", now.getYear(), weekOfYear);
    }

    /**
     * 获取上周标识
     */
    private String getLastWeekKey() {
        LocalDate lastWeek = LocalDate.now().minusWeeks(1);
        WeekFields weekFields = WeekFields.ISO;
        int weekOfYear = lastWeek.get(weekFields.weekOfWeekBasedYear());
        return String.format("%d-W%02d", lastWeek.getYear(), weekOfYear);
    }

    /**
     * 根据等级获取餐厅名称
     */
    private String getRestaurantName(int level) {
        return switch (level) {
            case 1 -> "街边小摊";
            case 2 -> "小饭馆";
            case 3 -> "人气餐厅";
            case 4 -> "知名酒楼";
            case 5 -> "米其林星级";
            default -> "小厨神的餐厅";
        };
    }
}
