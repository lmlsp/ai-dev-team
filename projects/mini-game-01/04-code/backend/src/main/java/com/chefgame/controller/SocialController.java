package com.chefgame.controller;

import com.chefgame.common.Result;
import com.chefgame.dto.response.SocialResponse;
import com.chefgame.service.SocialService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 社交 Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/friends")
@RequiredArgsConstructor
public class SocialController {

    private final SocialService socialService;

    /**
     * 获取好友列表
     * GET /api/v1/friends
     */
    @GetMapping
    public Result<SocialResponse> getFriends(@RequestAttribute("uid") String uid) {
        log.info("获取好友列表: uid={}", uid);
        SocialResponse response = socialService.getFriends(uid);
        return Result.ok(response);
    }

    /**
     * 查看好友餐厅
     * GET /api/v1/friends/{friendUid}/restaurant
     */
    @GetMapping("/{friendUid}/restaurant")
    public Result<SocialResponse> getFriendRestaurant(
            @RequestAttribute("uid") String uid,
            @PathVariable String friendUid) {
        log.info("查看好友餐厅: uid={}, friend={}", uid, friendUid);
        SocialResponse response = socialService.getFriendRestaurant(uid, friendUid);
        return Result.ok(response);
    }

    /**
     * 拜访好友餐厅
     * POST /api/v1/friends/{friendUid}/visit
     */
    @PostMapping("/{friendUid}/visit")
    public Result<SocialResponse> visitFriend(
            @RequestAttribute("uid") String uid,
            @PathVariable String friendUid) {
        log.info("拜访好友餐厅: uid={}, friend={}", uid, friendUid);
        SocialResponse response = socialService.visitFriend(uid, friendUid);
        return Result.ok(response);
    }

    /**
     * 给好友点赞
     * POST /api/v1/friends/{friendUid}/like
     */
    @PostMapping("/{friendUid}/like")
    public Result<SocialResponse> likeFriend(
            @RequestAttribute("uid") String uid,
            @PathVariable String friendUid) {
        log.info("给好友点赞: uid={}, friend={}", uid, friendUid);
        SocialResponse response = socialService.likeFriend(uid, friendUid);
        return Result.ok(response);
    }

    /**
     * 赠送能量给好友
     * POST /api/v1/friends/gift-energy
     */
    @PostMapping("/gift-energy")
    public Result<String> giftEnergy(
            @RequestAttribute("uid") String uid,
            @RequestBody java.util.Map<String, String> body) {
        String friendUid = body.get("friendUid");
        log.info("赠送能量: from={}, to={}", uid, friendUid);
        socialService.giftEnergy(uid, friendUid);
        return Result.ok("赠送成功");
    }

    /**
     * 收到的能量赠礼
     * GET /api/v1/friends/energy-gifts
     */
    @GetMapping("/energy-gifts")
    public Result<SocialResponse> getEnergyGifts(@RequestAttribute("uid") String uid) {
        log.info("获取能量赠礼: uid={}", uid);
        SocialResponse response = socialService.getEnergyGifts(uid);
        return Result.ok(response);
    }
}
