package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.request.MergeRequest;
import com.chefgame.dto.response.MergeResponse;
import com.chefgame.service.MergeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 合成 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/merges")
@RequiredArgsConstructor
public class MergeController {

    private final MergeService mergeService;

    /**
     * 单次合成校验（关键操作即时同步）
     * POST /api/v1/merges
     */
    @PostMapping
    public Result<MergeResponse> validateMerge(
            @RequestAttribute("uid") String uid,
            @Valid @RequestBody MergeRequest request) {
        log.info("合成请求: uid={}, {}{} + {}{}",
                uid,
                request.getFromItem().getT(), request.getFromItem().getL(),
                request.getToItem().getT(), request.getToItem().getL());
        MergeResponse response = mergeService.validateAndMerge(uid, request);
        return Result.ok(response);
    }
}
