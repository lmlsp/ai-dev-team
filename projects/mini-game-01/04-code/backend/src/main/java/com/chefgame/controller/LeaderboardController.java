package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.response.LeaderboardResponse;
import com.chefgame.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 排行榜 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    /**
     * 查询周排行榜（好评度排名）
     * GET /api/v1/leaderboard/weekly?page=1&size=20
     */
    @GetMapping("/weekly")
    public Result<LeaderboardResponse> getWeeklyRanking(
            @RequestAttribute("uid") String uid,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("查询周榜: uid={}, page={}, size={}", uid, page, size);
        LeaderboardResponse response = leaderboardService.getWeeklyRanking(page, size, uid);
        return Result.ok(response);
    }

    /**
     * 查询总排行榜（餐厅等级排名）
     * GET /api/v1/leaderboard/total?page=1&size=20
     */
    @GetMapping("/total")
    public Result<LeaderboardResponse> getTotalRanking(
            @RequestAttribute("uid") String uid,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        log.info("查询总榜: uid={}, page={}, size={}", uid, page, size);
        LeaderboardResponse response = leaderboardService.getTotalRanking(page, size, uid);
        return Result.ok(response);
    }

    /**
     * 查询我的排名
     * GET /api/v1/leaderboard/me/rank?type=weekly
     */
    @GetMapping("/me/rank")
    public Result<LeaderboardResponse> getMyRank(
            @RequestAttribute("uid") String uid,
            @RequestParam(defaultValue = "weekly") String type) {
        log.info("查询我的排名: uid={}, type={}", uid, type);
        LeaderboardResponse response = leaderboardService.getMyRank(uid, type);
        return Result.ok(response);
    }
}
