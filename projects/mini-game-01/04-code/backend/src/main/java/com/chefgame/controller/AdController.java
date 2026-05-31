package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.request.AdCallbackRequest;
import com.chefgame.dto.response.AdRewardResponse;
import com.chefgame.service.AdService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 广告 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ad")
@RequiredArgsConstructor
public class AdController {

    private final AdService adService;

    /**
     * 客户端上报广告观看（用于统计和发放奖励校验）
     * POST /api/v1/ad/watch
     */
    @PostMapping("/watch")
    public Result<AdRewardResponse> reportAdWatch(
            @RequestAttribute("uid") String uid,
            @Valid @RequestBody AdCallbackRequest request) {
        log.info("广告观看上报: uid={}, scene={}", uid, request.getScene());
        AdRewardResponse response = adService.clientWatchReport(uid, request);
        return Result.ok(response);
    }

    /**
     * 优量汇服务端回调验证（S2S）
     * POST /api/v1/ad/callback/ylh
     * 此接口在鉴权白名单中，不需要 JWT token
     */
    @PostMapping("/callback/ylh")
    public Map<String, Object> ylhCallback(@RequestBody AdCallbackRequest dto) {
        log.info("优量汇S2S回调: transId={}", dto.getTransId());
        try {
            adService.handleYlhCallback(dto);
            return Map.of("ret", 0, "msg", "ok");
        } catch (Exception e) {
            log.error("优量汇回调处理失败", e);
            return Map.of("ret", 1, "msg", e.getMessage());
        }
    }
}
