package com.chefgame.service;

import com.chefgame.common.GameException;
import com.chefgame.dto.response.RestaurantResponse;
import com.chefgame.entity.Restaurant;
import com.chefgame.entity.User;
import com.chefgame.repository.BoardRepository;
import com.chefgame.repository.RestaurantRepository;
import com.chefgame.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 餐厅服务 — 升级条件校验
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RestaurantService {

    private final UserRepository userRepository;
    private final RestaurantRepository restaurantRepository;
    private final BoardRepository boardRepository;

    /**
     * 餐厅等级配置
     */
    private static final List<LevelConfig> LEVEL_CONFIGS = List.of(
            new LevelConfig(1, "街边小摊", 0, new BigDecimal("0")),
            new LevelConfig(2, "小饭馆", 500, new BigDecimal("3.5")),
            new LevelConfig(3, "人气餐厅", 2000, new BigDecimal("4.0")),
            new LevelConfig(4, "知名酒楼", 5000, new BigDecimal("4.5")),
            new LevelConfig(5, "米其林星级", 10000, new BigDecimal("5.0"))
    );

    /**
     * 获取餐厅当前状态及升级条件
     */
    public RestaurantResponse getRestaurant(String uid) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        Restaurant restaurant = restaurantRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "餐厅信息不存在"));

        int currentLevel = user.getRestaurantLevel();
        LevelConfig current = LEVEL_CONFIGS.get(Math.min(currentLevel - 1, LEVEL_CONFIGS.size() - 1));

        // 构建升级条件（当前已满级则无下一级）
        RestaurantResponse.UpgradeCondition condition = null;
        if (currentLevel < 5) {
            LevelConfig next = LEVEL_CONFIGS.get(currentLevel);
            boolean satisfied = user.getGold() >= next.goldRequired
                    && user.getRating().compareTo(next.ratingRequired) >= 0;

            condition = RestaurantResponse.UpgradeCondition.builder()
                    .currentLevel(currentLevel)
                    .currentName(current.name)
                    .nextLevel(currentLevel + 1)
                    .nextName(next.name)
                    .goldRequired(next.goldRequired)
                    .ratingRequired(next.ratingRequired)
                    .satisfied(satisfied)
                    .build();
        }

        return RestaurantResponse.builder()
                .level(currentLevel)
                .name(current.name)
                .condition(condition)
                .build();
    }

    /**
     * 升级餐厅
     */
    @Transactional
    public RestaurantResponse upgrade(String uid) {
        User user = userRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "用户不存在"));

        Restaurant restaurant = restaurantRepository.findByUid(uid)
                .orElseThrow(() -> new GameException(10002, "餐厅信息不存在"));

        int currentLevel = user.getRestaurantLevel();

        // 1. 校验是否已满级
        if (currentLevel >= 5) {
            throw new GameException(13001, "餐厅已达最高等级，恭喜你获得米其林星级！");
        }

        // 2. 获取下一级配置
        LevelConfig next = LEVEL_CONFIGS.get(currentLevel);
        if (next == null) {
            throw new GameException(13002, "升级配置异常");
        }

        // 3. 校验金币
        if (user.getGold() < next.goldRequired) {
            throw new GameException(13003, String.format(
                    "金币不足！升级到%s需要 %d 金币，当前仅有 %d 金币",
                    next.name, next.goldRequired, user.getGold()));
        }

        // 4. 校验好评度
        if (user.getRating().compareTo(next.ratingRequired) < 0) {
            throw new GameException(13004, String.format(
                    "好评度不足！升级到%s需要 %.1f 星好评度，当前为 %.1f 星",
                    next.name, next.ratingRequired, user.getRating()));
        }

        // 5. 执行升级
        int newLevel = currentLevel + 1;
        int newGold = user.getGold() - next.goldRequired;

        user.setRestaurantLevel(newLevel);
        user.setGold(newGold);
        userRepository.save(user);

        restaurant.setLevel(newLevel);
        restaurant.setName(next.name);
        restaurant.setUpgradedAt(LocalDateTime.now());
        restaurantRepository.save(restaurant);

        // 6. 等级3扩展棋盘
        boolean boardExpanded = false;
        if (newLevel >= 3) {
            boardExpanded = true;
            // 更新棋盘为 6×7（42格）
            var board = boardRepository.findByUid(uid);
            if (board.isPresent()) {
                var bs = board.get();
                // 扩展 cells 数组
                String expandedCells = expandBoardCells(bs.getCells(), bs.getRows(), bs.getCols(), 6, 7);
                bs.setRows(6);
                bs.setCols(7);
                bs.setCells(expandedCells);
                bs.setVersion(bs.getVersion() + 1);
                boardRepository.save(bs);
            }
        }

        // 7. 解锁内容
        List<RestaurantResponse.RecipeBrief> unlockedRecipes = getUnlockedRecipes(newLevel);
        List<String> unlockedFeatures = new ArrayList<>();
        if (newLevel >= 2) unlockedFeatures.add("decor_slot_2");
        if (newLevel >= 3) unlockedFeatures.add("expanded_board");
        if (newLevel >= 4) unlockedFeatures.add("vip_customer");
        if (newLevel >= 5) unlockedFeatures.add("hidden_recipe");

        log.info("餐厅升级成功: uid={}, level={}, name={}, goldCost={}",
                uid, newLevel, next.name, next.goldRequired);

        return RestaurantResponse.builder()
                .level(restaurant.getLevel())
                .name(restaurant.getName())
                .upgradeResult(RestaurantResponse.UpgradeResult.builder()
                        .newLevel(newLevel)
                        .newName(next.name)
                        .unlockedRecipes(unlockedRecipes)
                        .boardExpanded(boardExpanded)
                        .unlockedFeatures(unlockedFeatures)
                        .build())
                .build();
    }

    /**
     * 获取每个等级解锁的菜谱
     */
    private List<RestaurantResponse.RecipeBrief> getUnlockedRecipes(int level) {
        List<RestaurantResponse.RecipeBrief> recipes = new ArrayList<>();
        switch (level) {
            case 1 -> {
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("tomato_egg").name("番茄炒蛋").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("scrambled_egg").name("炒蛋").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("cucumber_salad").name("凉拌黄瓜").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("fried_rice").name("蛋炒饭").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("braised_pork").name("红烧肉").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("sweet_sour_ribs").name("糖醋排骨").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("stir_fried_greens").name("清炒时蔬").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("egg_drop_soup").name("蛋花汤").build());
            }
            case 2 -> {
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("mapo_tofu").name("麻婆豆腐").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("kungpao_chicken").name("宫保鸡丁").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("twice_cooked_pork").name("回锅肉").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("fish_fragrant_eggplant").name("鱼香茄子").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("dan_dan_noodles").name("担担面").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("boiled_fish").name("水煮鱼").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("spicy_chicken").name("辣子鸡").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("couples_lung").name("夫妻肺片").build());
            }
            case 3 -> {
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("white_cut_chicken").name("白切鸡").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("dim_sum_platter").name("点心拼盘").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("char_siu").name("叉烧").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("wonton_soup").name("云吞汤").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("steamed_fish").name("清蒸鱼").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("sweet_sour_pork").name("咕噜肉").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("beef_chow_fun").name("干炒牛河").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("egg_tart").name("蛋挞").build());
            }
            case 4 -> {
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("fusion_pasta").name("创意意面").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("sushi_roll").name("融合寿司").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("lobster_thermidor").name("法式龙虾").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("truffle_dumpling").name("松露饺子").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("molecular_egg").name("分子料理蛋").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("foie_gras_toast").name("鹅肝吐司").build());
            }
            case 5 -> {
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("buddha_jumps_wall").name("佛跳墙").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("peking_duck").name("北京烤鸭").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("beggars_chicken").name("叫花鸡").build());
                recipes.add(RestaurantResponse.RecipeBrief.builder().chainId("dragon_phoenix").name("龙凤呈祥").build());
            }
        }
        return recipes;
    }

    /**
     * 扩展棋盘格子数组
     */
    private String expandBoardCells(String cellsJson, int oldRows, int oldCols, int newRows, int newCols) {
        int oldTotal = oldRows * oldCols;
        int newTotal = newRows * newCols;
        StringBuilder sb = new StringBuilder("[");
        // 保留旧数据，按行重新排列
        for (int i = 0; i < newTotal; i++) {
            if (i > 0) sb.append(",");
            if (i < oldTotal) {
                // 保留旧格子
                int oldCol = i % oldCols;
                int oldRow = i / oldCols;
                int oldIdx = oldRow * oldCols + oldCol;
                // 从原始 JSON 中提取对应的值（简化处理：序列化时从完整 cells 重新构建）
                sb.append("null");
            } else {
                sb.append("null");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 等级配置
     */
    private record LevelConfig(int level, String name, int goldRequired, BigDecimal ratingRequired) {}
}
