# 开源架构与硬件内容调研

调研日期：2026-10-15。通过 Steam 商店搜索接口、GitHub 搜索 API、项目原始 README 和 Wikipedia API 读取资料。GitHub API 中途触发频率限制，后续通过项目公开原始文件核对。

## 用户可能记得的 Steam 游戏

- [装机模拟器 / PC Building Simulator](https://store.steampowered.com/app/621060/)：电脑装配与维修，商店搜索返回了对应中文名称。
- [Computer Repair Shop](https://store.steampowered.com/app/2479290/)：电脑修理铺经营题材。仅凭用户对名称的回忆，不能确定是哪一款。

不复制这些商业游戏的模型、音效、UI 或其他素材。

## 可复用的开源基础

| 项目                                                                                                    | 许可                                    | 调研结果 / 本项目选择                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Three.js](https://github.com/mrdoob/three.js)                                                          | MIT                                     | 已核对 README。浏览器 3D 渲染库；本项目采用它及官方 OrbitControls、Raycaster、几何体和材质接口。它不是完整的游戏引擎，因此另写小型维修状态机。                       |
| [Phaser](https://github.com/phaserjs/phaser)                                                            | MIT                                     | 已读取 README；提供 WebGL / Canvas 的成熟网页游戏框架，适合 2D 交互。当前目标重视能旋转的零件工作台，因此本版选 Three.js。                                           |
| [Prism Forge / three-pc-builder-simulator](https://github.com/carlomigueldy/three-pc-builder-simulator) | MIT，Copyright (c) 2026 Carlo Miguel Dy | 已核对 README、LICENSE，并检查程序生成零件与场景组织函数。包含装机、兼容性、自检和工作台，可作后续参考。本项目没有拷贝其源代码或美术，使用独立的维修流程与自建模型。 |

其他搜索结果包括零件选配游戏和 PCBS 数据库，但部分没有明确许可证，也不直接覆盖新手维修教学，未引入代码或数据。

## 硬件知识来源

- [DIMM](https://en.wikipedia.org/wiki/DIMM)：通过 API 读取，核对内存模块、代际、缺口与不互换等概念。
- [Computer cooling](https://en.wikipedia.org/wiki/Computer_cooling)：通过 API 读取，核对散热片、空气流动、积灰、降频与过热保护。
- [Serial ATA](https://en.wikipedia.org/wiki/Serial_ATA)：图鉴参考入口。读取旧页面名时重定向至 SATA，部分 API 提取没有返回正文，因此没有把该次提取当作已完整验证的指南。
- [iFixit PC tower teardown](https://www.ifixit.com/Guide/PC+tower+teardown/139249)：实际页面标题是 PC tower teardown。一个看似“内存安装”的旧路径重定向到此页，未将它当成指定内存安装教程。
- 尝试读取 Crucial 官方桌面内存安装指南，但返回网站 403，未假称已读取。

图鉴与教学文本为本项目自己编写的简化解释，不复制维修图文。Wikipedia 文本适用其页面说明中的 CC BY-SA 等许可。新增专业章节应继续引入设备手册和可明确许可的图解，并做专业内容审校。

## 教学真实性

每张工单给出一个预设故障，并不表示该症状只有这一种原因。例如黑屏也可能涉及显示器、显卡和线材；无启动设备也不等于硬盘损坏。游戏要求先检查证据，再处理，最后验证。

固定螺丝数量、模型结构、测量读数和拆装动作均作了简化。万用表仅模拟断电通断档；USB 风扇为低压、可维护结构；键盘为支持热插拔的教学型号。家电高压、制冷、车辆与航空章节规划为专门的虚拟教学，不替代真实维修资质。
