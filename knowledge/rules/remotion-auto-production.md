---
id: "remotion-auto-production"
title: "Remotion 自动化视频生产规则"
category: "root"
tags: ["remotion 自动化视频生产规则", "🎯 工作流程（自动执行）", "📋 自动决策矩阵", "🤖 自动生成流程", "🎨 设计决策规则", "📝 用户输入示例 → 自动处理", "✅ 执行清单（自动检查）", "🚫 用户不需要做的事", "✅ 用户只需要做的事", "🎯 最终输出（自动生成）"]
source: "E:/Bobo's Coding cache/.claude/rules/remotion-auto-production.md"
---

# Remotion 自动化视频生产规则

> **核心原则**: 用户只需描述需求，系统自动匹配风格、生成代码

---

## 🎯 工作流程（自动执行）

```
用户简单描述需求
    ↓
自动分析场景类型 → 自动匹配设计风格 → 自动填充技术参数 → 直接生成代码
    ↓
输出完整的 Remotion 项目（包含素材生成指令）
```

---

## 📋 自动决策矩阵

### 场景类型识别（关键词触发）

| 用户需求关键词                | 场景类型   | 自动选择的风格                  |
| ----------------------------- | ---------- | ------------------------------- |
| "产品演示"、"SaaS"、"科技"    | 产品演示   | Glassmorphism + Tech Innovation |
| "社交媒体"、"短视频"、"Reels" | 社交内容   | Synthwave / Cyberpunk           |
| "教程"、"教学"、"如何"        | 教育视频   | Clean Modern + Minimalist       |
| "数据"、"报告"、"分析"        | 数据可视化 | Business Pro + Charts           |
| "品牌"、"故事"、"宣传"        | 品牌视频   | Creative Vibrant / Claymorphism |
| "游戏"、"酷炫"、"电竞"        | 游戏/电竞  | Cyberpunk + Neon                |
| "复古"、"怀旧"、"80年代"      | 复古风     | Synthwave + Memphis             |
| "简洁"、"高端"、"极简"        | 高端品牌   | Minimalist + Japanese Zen       |

### 自动配色方案

| 风格                 | 主色    | 辅助色  | 背景色  | 强调色  |
| -------------------- | ------- | ------- | ------- | ------- |
| **Tech Innovation**  | #0066ff | #00ffff | #1e1e1e | #FFFFFF |
| **Synthwave**        | #ff006e | #8338ec | #3a86ff | #FFFF00 |
| **Business Pro**     | #1C2833 | #F39C12 | #F4F6F6 | #E74C3C |
| **Creative Vibrant** | #E76F51 | #2A9D8F | #264653 | #F4A261 |
| **Cyberpunk**        | #00FFFF | #FF00FF | #0A0E27 | #FFFF00 |
| **Clean Modern**     | #2C3E50 | #3498DB | #ECF0F1 | #E74C3C |
| **Minimalist**       | #000000 | #FFFFFF | #F5F5F5 | #FF0000 |
| **Claymorphism**     | #A8DADC | #F1FAEE | #457B9D | #E63946 |

### 自动技术栈选择

| 场景特征                       | 自动启用的技术                     |
| ------------------------------ | ---------------------------------- |
| 包含"3D"、"立体"、"旋转"       | Three.js + React Three Fiber       |
| 包含"粒子"、"特效"、"背景"     | Processing Creative Skill          |
| 包含"图表"、"数据"、"增长"     | Chart animations + interpolate     |
| 包含"字幕"、"文字"、"说明"     | DisplayCaptions (TikTok风格)       |
| 包含"音乐"、"节奏"、"节拍"     | Audio visualization + useAudioData |
| 包含"卡通"、"可爱"、"动画"     | Lottie animations                  |
| 包含"照片"、"图片"、"素材"     | Nano Banana Pro 生成               |
| **包含"视频"、"动态"、"动画片段"** | **Seedance 2.0 视频生成** ⭐ (新增) |
| **包含"模板"、"现成"、"快速"** | **Remotion Templates Library**     |

### 自动模板匹配（新增）

> 📚 **完整模板库**: [REMOTION_TEMPLATES_LIBRARY.md](../capabilities/REMOTION_TEMPLATES_LIBRARY.md)

当用户需求可以使用现成模板时，自动推荐最合适的模板：

| 用户需求关键词             | 推荐模板             | 模板特点            |
| -------------------------- | -------------------- | ------------------- |
| "标题"、"开场"、"动态文字" | animated-text        | 字符逐个旋转入场    |
| "弹跳"、"卡片"、"商务"     | bounce-text          | 渐变卡片弹性入场    |
| "气泡"、"可爱"、"趣味"     | bubble-pop-text      | 圆形气泡依次弹出    |
| "列表"、"功能"、"特性"     | animated-list        | 列表项滑入+圆形图标 |
| "翻转"、"卡片"、"切换"     | card-flip            | 3D卡片360度翻转     |
| "悬浮"、"强调"、"霓虹"     | floating-bubble-text | 浮动+霓虹边框       |
| "几何"、"科技背景"         | geometric-patterns   | 几何图形旋转        |
| "故障"、"赛博朋克"         | glitch-text          | RGB分离抖动         |
| "液态"、"波浪"、"流体"     | liquid-wave          | 流动的液态波浪      |
| "矩阵"、"黑客"、"科幻"     | matrix-rain          | 绿色/蓝色字符雨     |
| "爆炸"、"粒子"、"转场"     | particle-explosion   | 粒子旋转爆炸        |
| "脉冲"、"节奏"、"音乐"     | pulsing-text         | 逐字脉冲闪烁        |
| "滑动"、"简单"、"字幕"     | slide-text           | 从右滑入            |
| "声波"、"音频"、"可视化"   | sound-wave           | 律动的声波条        |
| "打字机"、"字幕"、"对话"   | typewriter-subtitle  | 打字机+闪烁光标     |

**模板组合建议**（自动推荐）：

```typescript
// 产品介绍视频（30秒）
scenes = [
  { template: 'animated-text', duration: 5 }, // 标题
  { template: 'animated-list', duration: 15 }, // 功能列表
  { template: 'particle-explosion', duration: 3 }, // 转场
  { template: 'bounce-text', duration: 7 }, // CTA
];

// 音乐视频（60秒）
scenes = [
  { template: 'glitch-text', duration: 5 }, // 标题
  { template: 'sound-wave', duration: 45 }, // 声波可视化
  { template: 'pulsing-text', duration: 10 }, // 结尾
];

// 科技背景视频（持续循环）
layers = [
  { template: 'geometric-patterns', layer: 'background' },
  { template: 'matrix-rain', layer: 'overlay', opacity: 0.3 },
  { template: 'animated-text', layer: 'foreground' },
];
```

### 自动分辨率选择

| 用户提及                    | 自动设置              |
| --------------------------- | --------------------- |
| "Instagram"、"竖屏"、"手机" | 1080x1920 (9:16)      |
| "YouTube"、"横屏"、"电脑"   | 1920x1080 (16:9)      |
| "正方形"、"微信"、"朋友圈"  | 1080x1080 (1:1)       |
| "4K"、"高清"                | 3840x2160 (16:9)      |
| 未提及                      | 1920x1080 (16:9) 默认 |

### 自动帧率选择

| 场景类型           | 自动设置帧率 |
| ------------------ | ------------ |
| 游戏/电竞/酷炫特效 | 60fps        |
| 社交媒体/快节奏    | 30fps        |
| 教育/数据报告      | 30fps        |
| 品牌故事/电影感    | 24fps        |

---

## 🤖 自动生成流程

### Step 1: 需求分析（自动）

```python
def analyze_user_request(request: str):
    """自动分析用户需求"""

    # 提取关键信息
    scene_type = extract_scene_type(request)  # 产品演示/教育/数据等
    duration = extract_duration(request) or 30  # 默认30秒
    resolution = extract_resolution(request) or "1920x1080"

    # 情感分析
    mood = analyze_mood(request)  # 科技感/温暖/专业/酷炫

    # 自动匹配风格
    design_style = match_design_style(scene_type, mood)
    color_scheme = get_color_scheme(design_style)

    # 自动选择技术栈
    tech_stack = select_tech_stack(request)

    return {
        "scene_type": scene_type,
        "duration": duration,
        "resolution": resolution,
        "design_style": design_style,
        "color_scheme": color_scheme,
        "tech_stack": tech_stack
    }
```

### Step 2: 结构化 Prompt 生成（自动）

```python
def generate_structured_prompt(analysis):
    """根据分析结果自动生成完整的结构化 prompt"""

    prompt = f"""
创建 Remotion 视频项目：

【基本信息】
- 标题：{analysis.title}
- 时长：{analysis.duration}秒
- 比例：{analysis.aspect_ratio}
- 用途：{analysis.purpose}

【设计风格】（自动匹配）
- 主风格：{analysis.design_style}
- 配色方案：
  * 主色：{analysis.colors.primary}
  * 辅助色：{analysis.colors.secondary}
  * 背景色：{analysis.colors.background}
  * 强调色：{analysis.colors.accent}
- 动画风格：{analysis.animation_style}

【场景分镜】（自动设计）
{auto_generate_scenes(analysis)}

【技术需求】（自动启用）
{auto_select_tech_features(analysis)}

【素材需求】（自动生成指令）
{auto_generate_asset_commands(analysis)}

【输出要求】
- 分辨率：{analysis.resolution}
- 帧率：{analysis.fps}fps
- 格式：MP4（高质量）
"""

    return prompt
```

### Step 3: 代码生成（自动）

**优先级规则**：

1. **有现成模板** → 直接使用模板库（最快）
2. **需要自定义** → 基于模板修改（中等）
3. **特殊需求** → 从零生成代码（最慢）

**方案A：使用模板库**（推荐，速度快）

```typescript
// 1. 克隆模板库（仅首次）
git clone https://github.com/reactvideoeditor/remotion-templates.git

// 2. 复制需要的模板
cp remotion-templates/templates/animated-text.tsx ./src/components/
cp remotion-templates/templates/animated-list.tsx ./src/components/

// 3. 自定义内容
const text = "你的标题".split("");
const items = [
  { name: "你的功能1", color: "#3b82f6" },
  { name: "你的功能2", color: "#60a5fa" }
];

// 4. 集成到项目
<Composition
  id="MyVideo"
  component={CombinedScene}
  durationInFrames={240}
  fps={30}
  width={1920}
  height={1080}
/>
```

**方案B：从零生成**（特殊需求）

```
/my-video-project
  /src
    /components
      Scene1.tsx  # 自动生成
      Scene2.tsx  # 自动生成
      Scene3.tsx  # 自动生成
    /templates    # 新增：模板库
      animated-text.tsx
      animated-list.tsx
      particle-explosion.tsx
    /assets
      # Nano Banana Pro 生成指令
    /utils
      animations.ts  # 预设动画函数
    Root.tsx  # 主组件
    index.ts  # 注册组件
  /public
    # 静态资源
  package.json
  remotion.config.ts
```

**自动决策流程**：

```typescript
function select_generation_strategy(request: string) {
  // 1. 检查是否有完全匹配的模板
  const exact_match = find_exact_template(request);
  if (exact_match) {
    return {
      strategy: 'use_template',
      template: exact_match,
      customization: extract_custom_params(request),
    };
  }

  // 2. 检查是否可以组合现有模板
  const combinable = find_combinable_templates(request);
  if (combinable.length > 0) {
    return {
      strategy: 'combine_templates',
      templates: combinable,
      sequence: generate_sequence(combinable),
    };
  }

  // 3. 检查是否可以基于模板修改
  const similar = find_similar_template(request);
  if (similar) {
    return {
      strategy: 'modify_template',
      base_template: similar,
      modifications: extract_modifications(request),
    };
  }

  // 4. 从零生成
  return {
    strategy: 'generate_from_scratch',
    design_spec: analyze_full_requirements(request),
  };
}
```

---

## 🎨 设计决策规则

### 配色自动调整

```typescript
function auto_adjust_colors(scene_type: string, mood: string) {
  // 科技感 → 冷色调（蓝/青/紫）
  if (mood === 'tech' || scene_type === 'product') {
    return {
      primary: '#0066ff',
      secondary: '#00ffff',
      background: '#1e1e1e',
      accent: '#FFFFFF',
    };
  }

  // 温暖/友好 → 暖色调（橙/黄/粉）
  if (mood === 'warm' || scene_type === 'brand_story') {
    return {
      primary: '#E76F51',
      secondary: '#F4A261',
      background: '#FFFBF7',
      accent: '#2A9D8F',
    };
  }

  // 专业/商务 → 中性色（灰/蓝/红强调）
  if (mood === 'professional' || scene_type === 'data') {
    return {
      primary: '#2C3E50',
      secondary: '#34495E',
      background: '#ECF0F1',
      accent: '#E74C3C',
    };
  }

  // 酷炫/游戏 → 霓虹色（品红/青/黄）
  if (mood === 'cool' || scene_type === 'gaming') {
    return {
      primary: '#00FFFF',
      secondary: '#FF00FF',
      background: '#0A0E27',
      accent: '#FFFF00',
    };
  }
}
```

### 动画节奏自动匹配

```typescript
function auto_animation_timing(scene_type: string, duration: number) {
  const scenes = Math.ceil(duration / 10); // 每10秒一个场景

  // 产品演示：慢入场 + 中速展示 + 快速结尾
  if (scene_type === 'product') {
    return {
      intro: duration * 0.15, // 15% 用于入场
      main: duration * 0.7, // 70% 用于展示
      outro: duration * 0.15, // 15% 用于结尾
      transition: 15, // 15帧过渡
    };
  }

  // 社交媒体：快节奏
  if (scene_type === 'social') {
    return {
      intro: duration * 0.1, // 10% 快速入场
      main: duration * 0.7, // 70% 核心内容
      outro: duration * 0.2, // 20% 强化 CTA
      transition: 10, // 10帧快速切换
    };
  }

  // 教育：均匀节奏
  if (scene_type === 'education') {
    const step_duration = duration / scenes;
    return {
      intro: step_duration,
      main: step_duration * (scenes - 2),
      outro: step_duration,
      transition: 20, // 20帧舒适切换
    };
  }
}
```

---

## 📝 用户输入示例 → 自动处理

### 示例 1：极简输入

**用户说**：

```
做一个30秒的产品介绍视频，我们的产品是 AI 写作工具
```

**自动处理**：

```typescript
// 自动分析
scene_type = 'product_demo';
mood = 'tech';
duration = 30;
product_name = 'AI 写作工具';

// 自动匹配
design_style = 'Glassmorphism + Tech Innovation';
colors = { primary: '#0066ff', secondary: '#00ffff', bg: '#1e1e1e' };
tech_stack = ['Tailwind', 'Spring animations', 'Particle background'];

// 自动生成场景
scenes = [
  { name: 'Scene1: Logo入场', duration: 5, animation: 'spring_scale' },
  { name: 'Scene2: 核心功能', duration: 15, animation: 'slide_in' },
  { name: 'Scene3: 数据展示', duration: 7, animation: 'number_count' },
  { name: 'Scene4: CTA', duration: 3, animation: 'pulse' },
];

// 自动生成素材指令
nano_banana_prompts = [
  'AI writing tool dashboard UI, glassmorphism style, tech blue theme, 4K',
  'Text generation animation visual, futuristic interface, neon accents, 4K',
  'Writing assistant features showcase, clean modern design, 4K',
];

processing_background = 'Particle connections, tech style, blue cyan palette';
```

### 示例 2：带细节的输入

**用户说**：

```
创建一个60秒的季度数据报告视频，展示收入增长45%，用户从3万增长到5万，
要专业商务风格，重点突出增长趋势
```

**自动处理**：

```typescript
// 自动分析
scene_type = 'data_visualization';
mood = 'professional';
duration = 60;
key_metrics = {
  revenue_growth: '45%',
  user_growth: '30k → 50k',
};

// 自动匹配
design_style = 'Business Pro + Data Driven';
colors = { primary: '#2C3E50', secondary: '#E74C3C', bg: '#ECF0F1' };
tech_stack = ['Charts', 'Number animations', 'Tailwind'];

// 自动生成场景
scenes = [
  {
    name: 'Scene1: 开场',
    duration: 10,
    content: '标题 + 3个关键指标数字递增动画',
    animations: ['number_count_up', 'spring_bounce'],
  },
  {
    name: 'Scene2: 收入图表',
    duration: 15,
    content: '柱状图展示12个月收入',
    animations: ['bar_chart_rise', 'delay_sequence'],
  },
  {
    name: 'Scene3: 用户增长',
    duration: 15,
    content: '折线图展示用户增长趋势',
    animations: ['line_chart_draw', 'smooth_ease'],
  },
  {
    name: 'Scene4: 增长率',
    duration: 12,
    content: '饼图展示增长来源',
    animations: ['pie_chart_reveal', 'rotate'],
  },
  {
    name: 'Scene5: 结论',
    duration: 8,
    content: '总结文字 + Logo',
    animations: ['fade_in', 'text_slide'],
  },
];

// 自动选择字体
fonts = ['Roboto Medium', 'Inter Regular'];
```

### 示例 3：风格导向的输入

**用户说**：

```
做一个15秒的 Instagram 视频，要那种酷炫的赛博朋克风格，
介绍我们的游戏工作室
```

**自动处理**：

```typescript
// 自动分析
scene_type = 'social_media';
mood = 'cool_cyberpunk';
duration = 15;
platform = 'Instagram';
aspect_ratio = '9:16';

// 自动匹配
design_style = 'Cyberpunk + Neon';
colors = {
  primary: '#00FFFF',
  secondary: '#FF00FF',
  bg: '#0A0E27',
  accent: '#FFFF00',
};
tech_stack = ['Three.js', 'Glitch effects', 'Neon borders', 'Processing'];

// 自动生成场景
scenes = [
  {
    name: 'Scene1: Logo爆炸入场',
    duration: 3,
    effects: ['neon_glow', 'glitch_distortion', 'particle_explosion'],
    animations: ['scale_spring', 'rotation_3d'],
  },
  {
    name: 'Scene2: 游戏画面快速切换',
    duration: 8,
    effects: ['scanline_overlay', 'chromatic_aberration'],
    animations: ['rapid_crossfade', 'zoom_pulse'],
  },
  {
    name: 'Scene3: CTA + 社交媒体信息',
    duration: 4,
    effects: ['neon_text', 'hologram_flicker'],
    animations: ['text_glitch_in', 'button_pulse'],
  },
];

// Processing 背景
processing_effect = 'Neon grid + Matrix rain effect';

// 音频自动选择
audio_style = 'Synthwave electronic (high energy, 140 BPM)';
```

---

## ✅ 执行清单（自动检查）

每次生成代码前，自动检查：

```typescript
const auto_checklist = {
  design: {
    ✓ colors_matched_to_mood: true,
    ✓ style_consistent: true,
    ✓ accessibility_contrast: true
  },
  technical: {
    ✓ resolution_appropriate: true,
    ✓ fps_optimized: true,
    ✓ tech_stack_complete: true
  },
  performance: {
    ✓ assets_preloaded: true,
    ✓ animations_optimized: true,
    ✓ render_time_estimated: true
  },
  output: {
    ✓ complete_project_structure: true,
    ✓ asset_generation_commands: true,
    ✓ render_instructions: true
  }
};
```

---

## 🚫 用户不需要做的事

❌ 手动填写复杂的模板
❌ 选择设计风格（除非有特殊要求）
❌ 决定技术栈
❌ 计算场景时长分配
❌ 写配色代码
❌ 选择字体
❌ 决定动画类型
❌ 写素材生成 prompt

---

## ✅ 用户只需要做的事

✅ 描述视频的**目的**（产品演示/教育/社交媒体）
✅ 描述视频的**内容**（展示什么功能/讲什么故事）
✅ 可选：指定**时长**（不说默认30秒）
✅ 可选：指定**平台**（YouTube/Instagram/TikTok）
✅ 可选：特殊**风格偏好**（如果有强烈偏好）

---

## 🎯 最终输出（自动生成）

每次处理完用户需求后，自动输出：

1. **📋 分析总结**

   ```
   场景类型：产品演示
   设计风格：Glassmorphism + Tech Innovation
   配色方案：科技蓝 (#0066ff) + 霓虹青 (#00ffff)
   时长：30秒 | 分辨率：1920x1080 | 帧率：60fps
   ```

2. **🎨 完整的 Remotion 项目代码**
   - Root.tsx
   - Scene 组件（所有场景）
   - 动画工具函数
   - 配置文件

3. **🖼️ 素材生成指令**

   ```bash
   # Nano Banana Pro 生成静态图片
   uv run generate_image.py --prompt "..." --resolution 4K

   # Seedance 2.0 生成动态视频 ⭐ (新增)
   # 使用 seedance-prompt skill 自动生成提示词
   # 详见: .claude/skills/seedance-prompt.md

   # Processing 生成背景特效
   "Create particle connections background, tech style..."
   ```

4. **🎬 渲染命令**
   ```bash
   npm start  # 预览
   npx remotion render src/index.ts MyVideo out/video.mp4 --quality 100
   ```

---

## 🎬 Seedance 2.0 集成指南（新增）

> **完整文档**: `.claude/skills/seedance-prompt.md`
> **项目来源**: [awesome-seedance-2-prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts)
> **提示词库**: 180+ 验证过的专业模板

### 核心定位

```
素材生成工具选择：
├─ 静态图像 → Nano Banana Pro（图片、背景）
├─ 动态视频 → Seedance 2.0 ⭐（视频片段、动画）
└─ 视频编排 → Remotion（合成、字幕、特效）
```

### 自动触发条件

当用户需求包含以下关键词时，自动推荐 Seedance 2.0：

| 关键词 | 场景 | 模板类型 |
|--------|------|----------|
| "电影级"、"大片"、"cinematic" | 电影场景 | Ultra-Realistic / Photorealistic |
| "打斗"、"动作"、"action" | 动作序列 | Combat / Transformation |
| "科幻"、"太空"、"sci-fi" | 科幻场景 | Space Battle / Wormhole |
| "时尚"、"T台"、"fashion" | 时尚大片 | Haute Couture / Editorial |
| "恐怖"、"惊悚"、"horror" | 恐怖片段 | Tension Build / Atmosphere |
| "第一人称"、"POV" | FPV视角 | First-Person Perspective |
| "动漫"、"二次元"、"anime" | 动漫风格 | Anime Transformation |
| "视频片段"、"动态素材" | 通用视频 | General Cinematic |

### 快速使用流程

```
1. 用户描述需求
   ↓
2. 检测关键词 → 自动加载 seedance-prompt skill
   ↓
3. 智能推荐提示词模板
   ↓
4. 自定义参数（时长、分辨率、风格）
   ↓
5. 生成完整 Seedance 提示词
   ↓
6. 用户使用 Seedance 2.0 生成视频
   ↓
7. 将生成的视频集成到 Remotion 项目
```

### 示例：电影级场景

**用户说**: "做一个15秒的电影级场景，老鹰飞越城市"

**自动处理**:

```markdown
【识别】
- 类型: Cinematic（电影级）
- 元素: 老鹰 + 城市飞行
- 时长: 15秒

【推荐模板】: "Ultra-Realistic Animal Cinematic"

【生成提示词】:

Ultra-realistic cinematic sequence of a golden eagle launching from a rocky cliff
at dawn, wings extending with visible feather separation and aerodynamic drag. The
bird glides forward over a dense urban skyline, banking left to avoid obstacles,
then lands on a rooftop sign.

Camera tracks parallel at mid-distance using a stabilized aerial rig. Background
reveals morning haze diffusion and directional sunlight from low east angle casting
elongated shadows across glass facades.

Technical specs:
- Duration: 15 seconds
- Resolution: 16:9, 1080p
- Style: ultra-realistic cinematic
- Lighting: natural morning light
- Physics: authentic bird anatomy, realistic airflow

【集成到 Remotion】:

// 1. Seedance 生成视频（15秒）
const eagleClip = './assets/seedance/eagle-flight.mp4';

// 2. Remotion 编排
<Sequence from={0} durationInFrames={450}>
  <Video src={eagleClip} />
  <Sequence from={390}>
    <AnimatedText text="AMBITION" /> {/* 最后3秒叠加文字 */}
  </Sequence>
</Sequence>
```

### 示例：科幻场景

**用户说**: "生成一个太空战舰穿越虫洞的场景"

**自动处理**:

```markdown
【识别】
- 类型: Sci-Fi（科幻）
- 元素: 战舰 + 虫洞
- 默认时长: 10秒

【推荐模板】: "Sci-Fi Wormhole Traversal"

【生成提示词】:

In distant outer space, a massive battleship traverses a wormhole. The ship's hull
glows with energy as space-time distorts around it. The wormhole's gravitational
waves ripple across the vessel's surface. Bridge lights flicker as the crew braces
for dimensional transition.

Camera starts with wide shot, follows ship through tunnel with dynamic movement.
Space-time distortion creates swirling energy patterns. Exit portal appears ahead,
emanating brilliant light.

Technical specs:
- Duration: 10 seconds
- Resolution: 16:9, 1080p
- Style: hyperrealistic sci-fi
- VFX: wormhole distortion, energy trails, lens flares

【集成到 Remotion】:

const wormholeClip = './assets/seedance/wormhole.mp4';

<Composition>
  <Sequence from={0} durationInFrames={300}>
    <Video src={wormholeClip} />
    {/* 叠加科幻UI元素 */}
    <SciFiHUD />
  </Sequence>
</Composition>
```

### 技术参数自动映射

| Seedance 2.0 | Remotion 对应 | 说明 |
|-------------|--------------|------|
| 4-6秒视频 | 120-180 frames @ 30fps | 短片段 |
| 8-12秒视频 | 240-360 frames @ 30fps | 标准片段 |
| 13-15秒视频 | 390-450 frames @ 30fps | 长片段 |
| 16:9 分辨率 | 1920x1080 | 横屏视频 |
| 9:16 分辨率 | 1080x1920 | 竖屏视频 |
| 1:1 分辨率 | 1080x1080 | 正方形 |

### 与其他工具配合

```typescript
// 完整视频制作流程
const workflow = {
  // 1. Nano Banana Pro: 静态元素
  background: generateImage('科幻城市背景', '4K'),

  // 2. Seedance 2.0: 动态元素
  spaceshipFlight: generateSeedanceVideo({
    prompt: '[Seedance提示词]',
    duration: 10,
    resolution: '1920x1080'
  }),

  // 3. Remotion: 编排合成
  finalVideo: (
    <Composition>
      <Sequence from={0}>
        <Img src={background} /> {/* 静态背景 */}
      </Sequence>
      <Sequence from={0} durationInFrames={300}>
        <Video src={spaceshipFlight} /> {/* 动态飞船 */}
      </Sequence>
      <Sequence from={240}>
        <AnimatedText /> {/* Remotion 动画 */}
      </Sequence>
    </Composition>
  )
};
```

### 质量检查清单

使用 Seedance 2.0 前确认：

- [ ] 需求是否需要**动态视频**（而非静态图像）
- [ ] 时长在 **4-15秒** 范围内
- [ ] 场景类型在 Seedance 擅长的8大类中
- [ ] 已准备好详细的场景描述
- [ ] 明确了分辨率和风格要求

### 性能对比

| 方案 | 耗时 | 质量 | 灵活性 | 适用场景 |
|------|------|------|--------|----------|
| **Seedance 2.0** | 5-10分钟 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 电影级动态场景 |
| **Nano Banana Pro** | 2-5分钟 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 静态图像、插画 |
| **Remotion 从零编码** | 1-2小时 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 自定义交互动画 |
| **Remotion 模板** | 5-15分钟 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 文字动画、UI元素 |

**建议**：动态场景用 Seedance 2.0，静态元素用 Nano Banana Pro，编排合成用 Remotion。

### 更新机制

```bash
# 定期同步最新提示词库（每周）
cd "E:/Bobo's Coding cache/seedance-prompts"
git pull origin main

# 或使用快捷命令
node scripts/update-seedance-prompts.js
```

---

## 📚 模板库集成指南（新增）

> **完整文档**: [REMOTION_TEMPLATES_LIBRARY.md](../capabilities/REMOTION_TEMPLATES_LIBRARY.md)

### 快速决策树

```
用户需求
  ↓
检查模板库
  ↓
  ├─ 有现成模板 → 直接使用（5分钟）
  │   ├─ 复制模板文件
  │   ├─ 修改文字/颜色
  │   └─ 集成到项目
  │
  ├─ 可以组合 → 组合模板（15分钟）
  │   ├─ 选择2-4个模板
  │   ├─ 设计时间线
  │   └─ 添加过渡效果
  │
  ├─ 需要修改 → 基于模板改（30分钟）
  │   ├─ 选择最相似的模板
  │   ├─ 修改动画逻辑
  │   └─ 调整视觉效果
  │
  └─ 特殊需求 → 从零生成（1-2小时）
      ├─ 完整需求分析
      ├─ 设计组件结构
      └─ 编写自定义代码
```

### 自动推荐逻辑

```typescript
function auto_recommend_templates(user_request: string) {
  const keywords = extract_keywords(user_request);

  // 1. 直接匹配
  if (keywords.includes('标题') || keywords.includes('开场')) {
    return {
      primary: 'animated-text',
      alternatives: ['bounce-text', 'bubble-pop-text'],
      reason: '标题动画首选',
    };
  }

  // 2. 场景组合
  if (keywords.includes('产品介绍')) {
    return {
      combination: [
        { template: 'animated-text', role: 'intro', duration: '10%' },
        { template: 'animated-list', role: 'features', duration: '60%' },
        { template: 'particle-explosion', role: 'transition', duration: '10%' },
        { template: 'bounce-text', role: 'cta', duration: '20%' },
      ],
      reason: '产品介绍标准流程',
    };
  }

  // 3. 风格匹配
  if (keywords.includes('赛博朋克') || keywords.includes('科幻')) {
    return {
      style_pack: ['glitch-text', 'matrix-rain', 'neon-effects'],
      background: 'geometric-patterns',
      reason: '赛博朋克视觉套装',
    };
  }

  // 4. 功能匹配
  if (keywords.includes('音乐') || keywords.includes('节奏')) {
    return {
      primary: 'sound-wave',
      secondary: 'pulsing-text',
      sync: 'use useAudioData for real-time sync',
      reason: '音频可视化专用',
    };
  }
}
```

### 模板使用示例

#### 示例 1：快速标题动画

**用户说**："做一个标题动画，文字是'欢迎来到未来'"

**自动处理**：

```typescript
// 1. 选择模板：animated-text（最适合）
// 2. 修改内容
const text = '欢迎来到未来'.split('');

// 3. 调整配色（可选）
color: '#00ffff'; // 青色，符合"未来"主题

// 4. 生成代码
import AnimatedText from './templates/animated-text';

// 完成！耗时：2分钟
```

#### 示例 2：产品功能展示

**用户说**："展示我们产品的3个核心功能"

**自动处理**：

```typescript
// 1. 选择模板：animated-list（完美匹配）
// 2. 自定义数据
const items = [
  { name: 'AI 智能写作', color: '#3b82f6' },
  { name: '实时协作', color: '#60a5fa' },
  { name: '多语言支持', color: '#93c5fd' },
];

// 3. 调整动画速度（可选）
delay: i * 8; // 从5帧改为8帧，更舒缓

// 完成！耗时：5分钟
```

#### 示例 3：音乐可视化

**用户说**："做一个音乐视频，要有声波效果"

**自动处理**：

```typescript
// 1. 选择模板：sound-wave + pulsing-text（组合）
// 2. 添加音频同步
import { useAudioData, Audio } from "remotion";

const audioData = useAudioData("./music.mp3");
const amplitude = audioData?.getAmplitude(frame) || 0;

// 3. 驱动声波高度
const height = amplitude * 200;

// 4. 背景层
<GeometricPatterns />  // 添加科技感背景

// 完成！耗时：15分钟
```

#### 示例 4：赛博朋克开场

**用户说**："做一个酷炫的赛博朋克风格开场"

**自动处理**：

```typescript
// 1. 风格套装：glitch-text + matrix-rain + geometric-patterns
// 2. 层次结构
<AbsoluteFill>
  {/* 背景层 */}
  <div style={{ zIndex: 1 }}>
    <MatrixRain />
  </div>

  {/* 几何层 */}
  <div style={{ zIndex: 2, opacity: 0.5 }}>
    <GeometricPatterns />
  </div>

  {/* 文字层 */}
  <div style={{ zIndex: 3 }}>
    <GlitchText />
  </div>
</AbsoluteFill>

// 3. 配色调整为霓虹色
colors = {
  primary: "#00FFFF",
  secondary: "#FF00FF",
  accent: "#FFFF00"
}

// 完成！耗时：10分钟
```

### 性能对比

| 方案             | 耗时      | 质量       | 灵活性     | 推荐场景   |
| ---------------- | --------- | ---------- | ---------- | ---------- |
| **使用现成模板** | 2-5分钟   | ⭐⭐⭐⭐   | ⭐⭐⭐     | 标准需求   |
| **组合多个模板** | 10-15分钟 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | 中等复杂度 |
| **基于模板修改** | 20-30分钟 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 有特殊需求 |
| **从零生成代码** | 1-2小时   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 独特创意   |

**建议**：80% 的需求可以用现成模板或组合解决，只有 20% 需要从零生成。

### 模板库维护

**本地模板路径**：

```bash
E:/Bobo's Coding cache/remotion-templates-lib/templates/
```

**更新模板库**：

```bash
cd "E:/Bobo's Coding cache/remotion-templates-lib"
git pull origin main
```

**查看所有模板**：

```bash
ls templates/*.tsx
# 输出：15个模板文件
```

**测试单个模板**：

```bash
# 在 Remotion 项目中
npm start
# 在浏览器中预览各个模板
```

---

## 🔄 更新到 CLAUDE.md

这个自动化规则已集成到你的工作流程中，当检测到视频创作需求时自动激活。

**模板库优先级**：

- ✅ 优先推荐现成模板
- ✅ 其次建议模板组合
- ✅ 必要时基于模板修改
- ✅ 最后才从零生成
