# API 集成实战模式

## RunningHub 平台

### 三种执行路径
| 路径 | 用途 | Endpoint |
|------|------|----------|
| 模板 + nodeInfoList | 标准工作流（换参数跑） | `POST /task/openapi/create` with `workflowId` |
| AI App (webapp) | 封装好的应用（简化入参） | `POST /task/openapi/ai-app/run` with `webappId` |
| Workspace setContent | ❌ 不可靠，不要用 | - |

### 通用调用模式
```python
# 1. 上传素材
upload_resp = POST /task/openapi/upload (multipart: apiKey + file)
file_path = upload_resp["data"]["fileName"]  # "api/<hash>.<ext>"

# 2. 创建任务
create_resp = POST /task/openapi/create {
    "apiKey": key,
    "workflowId": "...",
    "nodeInfoList": [{"nodeId": "85", "fieldName": "image", "fieldValue": file_path}]
}
task_id = create_resp["data"]["taskId"]

# 3. 轮询状态（exponential backoff）
status_resp = POST /task/openapi/status {"apiKey": key, "taskId": task_id}
# QUEUING → GENERATING → SUCCESS/FAILED

# 4. 获取输出
outputs_resp = POST /task/openapi/outputs {"apiKey": key, "taskId": task_id}
```

### 关键注意
- `fieldValue` 用上传返回的 `api/<hash>.<ext>` 整串，不要去前缀
- payload 最精简就过，不加 `instanceType`/`usePersonalQueue` 等额外字段
- 同 apiKey 同时 2 个 task 会排队（code 804），不是并行
- 视频任务 ~17min/次，分钟级间隔才行

## Modal gRPC API（历史数据拉取）

### 关键发现
CLI 只流实时，但 SDK 底层有完整历史 API：
- `AppFetchLogsRequest(app_id, since, until, limit=1000, search_text=...)`
- `AppCountLogsRequest(app_id, since, until, bucket_secs=3600)`
- 分批游标：`max(timestamp) + 1us` 作下一批 since

### 瞬时并发计算
按 `function_call_id` 聚合 → 正则提 `task_cost_time` → 重建 (start, end) → 滑窗算重叠

## Notion API

### 文件上传限制
- Integration bot token: 单文件 **20MB 上限**
- 超过 → ffmpeg 重编码: `ffmpeg -i in.mp4 -vf scale=-2:832 -c:v libx264 -b:v 12M -c:a aac -b:a 128k out.mp4`
- 批量绑定：同一 upload id 要绑定所有引用行（不只主行）

### Database 操作
- 用 `Bot_ID`（rich_text）精确匹配，不按名字（名字经常不同）
- `multi_select` 字段：添加 tag 时保留已有 tags + append 新的
- `data_source_id` 获取 schema（properties 在 page 级别已空）

## Semrush SEO API

### 双流并行（不可合并）
1. `domain_organic` → 竞品长尾词（11 家竞品 Top 500）
2. `phrase_these` → 热点大词种子扩展（新模型词 2025-2026）

### 过滤规则
- vol < 10K → 剔除
- IP/明星名 → 2-3 word 纯字母无品类词启发式
- 对手品牌/拼写错误 → NAV_BLACKLIST
- 站内已有 → CMS canonical 去重（4 层: exact_core_kw / ai 前缀 / slug / token subset）

### KD 策略
- KD ≤60 → 开 landing bot
- KD 60-80 → 对比教程/alternative 页
- KD >80 → 周边工具吸相关流量

## Base44 CMS

### 查询命令
```bash
bash company-skills/base44/scripts/query.sh cms LandingPage list "environment=production-porn&limit=1000"
```
返回 `core_keyword + slug_id + bot_name` 用于站内去重。

## MyShell Workshop API

### Bot 创建（不需要 UI）
```
POST /shell_agent/api/app/v3/create {name, description, cover, nsfw, template_id:"", creator_name}
→ app_id (UUID)
```

### 两阶段 ID
- 阶段 1: `app_id` = UUID（开发版，workshop 内部用）
- 阶段 2: `bot_id` = 整数（publish 后分配，线上用）
- LP 只有 bot publish 后才应该建

### 审核是自己人
submit_review 后贴 workshop_url 给审核人（冲哥/bobooo/Amy），点通过 → 自动 publish → 分配 int bot_id。
