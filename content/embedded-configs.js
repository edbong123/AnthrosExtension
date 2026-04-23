const EMBEDDED_INDEX = {
  "version": 1,
  "platforms": [
    {
      "id": "tiktok",
      "label": "TikTok",
      "active": true
    },
    {
      "id": "youtube",
      "label": "YouTube",
      "active": true
    },
    {
      "id": "instagram",
      "label": "Instagram",
      "active": true
    },
    {
      "id": "facebook",
      "label": "Facebook",
      "active": false
    }
  ]
};

const EMBEDDED_PLATFORMS = {
  "tiktok": {
    "id": "tiktok",
    "label": "TikTok",
    "version": 4,
    "hostMatch": "tiktok.com",
    "profileUrlPattern": "tiktok.com/@",
    "type": "json_script",
    "scriptId": "__UNIVERSAL_DATA_FOR_REHYDRATION__",
    "fields": {
      "username": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.uniqueId",
      "displayName": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.nickname",
      "bio": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.signature",
      "followers": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.followerCount",
      "following": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.followingCount",
      "videoCount": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.videoCount",
      "heartCount": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.stats.heartCount",
      "verified": "__DEFAULT_SCOPE__.webapp.user-detail.userInfo.user.verified"
    }
  },
  "youtube": {
    "id": "youtube",
    "label": "YouTube",
    "version": 4,
    "hostMatch": "youtube.com",
    "profileUrlPattern": "youtube.com/@",
    "type": "json_script",
    "scriptId": null,
    "scriptMatch": "var ytInitialData",
    "scriptClean": "var ytInitialData = ",
    "fields": {
      "username": "header.pageHeaderRenderer.content.pageHeaderViewModel.metadata.contentMetadataViewModel.metadataRows.0.metadataParts.0.text.content",
      "displayName": "metadata.channelMetadataRenderer.title",
      "bio": "metadata.channelMetadataRenderer.description",
      "subscribers": "header.pageHeaderRenderer.content.pageHeaderViewModel.metadata.contentMetadataViewModel.metadataRows.1.metadataParts.0.text.content",
      "videoCount": "header.pageHeaderRenderer.content.pageHeaderViewModel.metadata.contentMetadataViewModel.metadataRows.1.metadataParts.1.text.content",
      "channelId": "metadata.channelMetadataRenderer.externalId"
    }
  },
  "instagram": {
    "id": "instagram",
    "label": "Instagram",
    "version": 8,
    "hostMatch": "instagram.com",
    "profileUrlPattern": "instagram.com/",
    "type": "xhr_intercept",
    "urlMatch": "/api/v1/users/web_profile_info/",
    "fields": {
      "username": "data.user.username",
      "displayName": "data.user.full_name",
      "bio": "data.user.biography",
      "followers": "data.user.edge_followed_by.count",
      "following": "data.user.edge_follow.count",
      "verified": "data.user.is_verified",
      "is_business": "data.user.is_professional_account"
    }
  },
  "facebook": {
    "id": "facebook",
    "label": "Facebook",
    "version": 1,
    "hostMatch": "facebook.com",
    "profileUrlPattern": "facebook.com/",
    "type": "dom",
    "selectors": {
      "displayName": "h1 span",
      "profileImage": "img[alt*='profile picture']"
    },
    "fields": {
      "displayName": "displayName",
      "profileImage": "profileImage"
    }
  }
};
