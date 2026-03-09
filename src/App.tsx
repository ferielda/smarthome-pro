/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useReducer } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, 
  LayoutGrid, 
  User, 
  Plus, 
  Power, 
  Lightbulb, 
  Thermometer, 
  ShieldCheck, 
  Wind, 
  ChevronRight, 
  ChevronLeft,
  Settings, 
  Bell, 
  LogOut,
  Moon,
  Sun,
  Coffee,
  Tv,
  Plug,
  PanelTopClose,
  RotateCw,
  Refrigerator,
  Speaker,
  Mic,
  Send,
  Trash2,
} from 'lucide-react';
import { chatWithZhipu, type ChatMessage } from './api/zhipu';

// --- Types ---
type View = 'login' | 'register' | 'home';
type Tab = 'devices' | 'scenes' | 'assistant' | 'profile';

/** 空调模式 */
type AcMode = 'cool' | 'heat' | 'dry' | 'fan' | 'auto';
/** 空调风速 */
type AcWindSpeed = 'low' | 'medium' | 'high' | 'auto';
/** 上下扫风 */
type AcSwingV = 'up' | 'center' | 'down';
/** 左右扫风 */
type AcSwingH = 'left' | 'center' | 'right';

/** 插座插孔 */
interface SocketOutlet {
  id: string;
  /** 插入的设备名称 */
  deviceName: string;
  on: boolean;
}

interface Device {
  id: string;
  name: string;
  type: 'light' | 'ac' | 'security' | 'sensor' | 'socket' | 'curtain' | 'washer' | 'fridge' | 'tv' | 'speaker';
  status: boolean;
  value?: string;
  room: string;
  /** 灯光亮度 1-4 档 */
  lightBrightness?: number;
  /** 灯光色调 1-3 档（暖光/自然/冷光） */
  lightTone?: number;
  /** 空调温度 16-30 */
  acTemperature?: number;
  /** 空调模式 */
  acMode?: AcMode;
  /** 空调风速 */
  acWindSpeed?: AcWindSpeed;
  /** 空调上下扫风 */
  acSwingV?: AcSwingV;
  /** 空调左右扫风 */
  acSwingH?: AcSwingH;
  /** 插座各插孔：设备名称与开关 */
  socketOutlets?: SocketOutlet[];
  /** 插座总耗电量（千瓦时） */
  socketPowerUsage?: number;
  /** 冰箱冷藏室温度 °C */
  fridgeTempFresh?: number;
  /** 冰箱软冻层温度 °C */
  fridgeTempSoft?: number;
  /** 冰箱冷冻室温度 °C */
  fridgeTempFrozen?: number;
  /** 冰箱内食材信息（用户输入或语音） */
  fridgeIngredients?: string;
  /** 窗帘开合百分比 0-100 */
  curtainOpenPercent?: number;
  /** 电视音量 0-100 */
  tvVolume?: number;
  /** 洗衣机程序 */
  washerProgram?: string;
  /** 洗衣机运行状态文案 */
  washerStatus?: string;
  /** 音响音量 0-100 */
  speakerVolume?: number;
}

interface Scene {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

/** 场景下某设备的目标状态（执行场景时应用） */
interface SceneDeviceTarget {
  deviceId: string;
  status: boolean;
  lightBrightness?: number;
  lightTone?: number;
  acTemperature?: number;
  acMode?: AcMode;
  acWindSpeed?: AcWindSpeed;
  fridgeTempFresh?: number;
  fridgeTempSoft?: number;
  fridgeTempFrozen?: number;
  socketOutlets?: SocketOutlet[];
}

/** 场景配置：该场景要控制的设备及目标状态 */
interface SceneConfig {
  sceneId: string;
  deviceTargets: SceneDeviceTarget[];
}

// --- Constants ---
const PRIMARY_COLOR = '#57C7C3';

const INITIAL_DEVICES: Device[] = [
  { id: '1', name: '客厅大灯', type: 'light', status: true, room: '客厅', lightBrightness: 4, lightTone: 2 },
  { id: '2', name: '卧室空调', type: 'ac', status: false, value: '24°C', room: '主卧', acTemperature: 24, acMode: 'cool', acWindSpeed: 'medium', acSwingV: 'center', acSwingH: 'center' },
  { id: '3', name: '智能门锁', type: 'security', status: true, room: '玄关' },
  { id: '4', name: '空气净化器', type: 'sensor', status: true, value: '优', room: '客厅' },
  { id: '5', name: '走廊灯', type: 'light', status: false, room: '走廊', lightBrightness: 3, lightTone: 1 },
  {
    id: '6',
    name: '客厅插座',
    type: 'socket',
    status: true,
    room: '客厅',
    socketPowerUsage: 1.25,
    socketOutlets: [
      { id: 'o1', deviceName: '台灯', on: true },
      { id: 'o2', deviceName: '手机充电器', on: false },
      { id: 'o3', deviceName: '风扇', on: true },
      { id: 'o4', deviceName: '', on: false },
    ],
  },
  { id: '7', name: '主卧窗帘', type: 'curtain', status: false, room: '主卧', curtainOpenPercent: 0 },
  { id: '8', name: '洗衣机', type: 'washer', status: false, room: '浴室', washerProgram: '标准洗', washerStatus: '已关闭' },
  { id: '9', name: '冰箱', type: 'fridge', status: true, room: '厨房', fridgeTempFresh: 4, fridgeTempSoft: -2, fridgeTempFrozen: -18 },
  { id: '10', name: '电视', type: 'tv', status: false, room: '客厅', tvVolume: 50 },
  { id: '11', name: '音响组', type: 'speaker', status: false, room: '客厅', speakerVolume: 60 },
];

const SCENES: Scene[] = [
  { id: '1', name: '离家模式', icon: <Sun className="w-6 h-6" />, color: 'bg-orange-100 text-orange-600' },
  { id: '2', name: '回家模式', icon: <Coffee className="w-6 h-6" />, color: 'bg-blue-100 text-blue-600' },
  { id: '3', name: '观影模式', icon: <Tv className="w-6 h-6" />, color: 'bg-purple-100 text-purple-600' },
  { id: '4', name: '睡眠模式', icon: <Moon className="w-6 h-6" />, color: 'bg-indigo-100 text-indigo-600' },
];

/** 自定义场景（点击「自定义场景」按钮后进入编辑） */
const CUSTOM_SCENE: Scene = { id: 'custom', name: '自定义场景', icon: <Plus className="w-6 h-6" />, color: 'bg-gray-100 text-gray-600' };

const DEVICE_ORDER_KEY = 'smarthome-device-order';
const DEVICE_STATE_KEY = 'smarthome-device-state';
const INGREDIENT_LIBRARY_KEY = 'smarthome-fridge-ingredient-library';
const SCENE_CONFIG_KEY = 'smarthome-scene-configs';

/** 食材库单项：名字、存量、入库时间 */
interface FridgeIngredientItem {
  id: string;
  name: string;
  quantity: string;
  storedAt: number;
}

function loadIngredientLibrary(): FridgeIngredientItem[] {
  try {
    const raw = localStorage.getItem(INGREDIENT_LIBRARY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 已存放时间：不足 24 小时显示小时，不足 30 天显示天，否则显示月。asOf 为“当前”时间戳，不传则用 Date.now()，传则按该时刻计算（如打开食材库时传入以得到当时的最新时长） */
function formatStoredTime(storedAt: number, asOf?: number): string {
  const now = asOf ?? Date.now();
  const h = (now - storedAt) / (3600 * 1000);
  if (h < 24) return `${Math.max(0, Math.floor(h))}小时`;
  if (h < 24 * 30) return `${Math.floor(h / 24)}天`;
  return `${Math.floor(h / (24 * 30))}月`;
}

/** 供 AI 助手使用的设备摘要（可序列化） */
function buildDeviceContext(devices: Device[]): string {
  return JSON.stringify(devices.map(d => {
    const base: Record<string, unknown> = { name: d.name, room: d.room, type: d.type, status: d.status };
    if (d.type === 'light') {
      base.lightBrightness = d.lightBrightness ?? 4;
      base.lightTone = d.lightTone ?? 2;
    }
    if (d.type === 'ac') {
      base.acTemperature = d.acTemperature ?? 24;
      base.acMode = d.acMode ?? 'cool';
      base.acWindSpeed = d.acWindSpeed ?? 'medium';
    }
    if (d.type === 'socket' && d.socketOutlets) {
      base.socketOutlets = d.socketOutlets.map(o => ({ deviceName: o.deviceName, on: o.on }));
    }
    if (d.type === 'fridge') {
      base.fridgeTempFresh = d.fridgeTempFresh ?? 4;
      base.fridgeTempSoft = d.fridgeTempSoft ?? -2;
      base.fridgeTempFrozen = d.fridgeTempFrozen ?? -18;
    }
    return base;
  }), null, 2);
}

/** 意图：场景 + 设备类型 + 操作（大模型只输出分类，由后台匹配设备并执行） */
export type AssistantIntent = { scene: string; deviceType: string; operation: string; value?: number | string | null };

const SCENE_TO_ROOM: Record<string, string | null> = { 全部场景: null, 客厅: '客厅', 卧室: '主卧', 主卧: '主卧', 次卧: '次卧', 厨房: '厨房', 浴室: '浴室', 玄关: '玄关', 走廊: '走廊' };
const DEVICE_TYPE_TO_MAP: Record<string, Device['type'] | null> = {
  灯: 'light', 冰箱: 'fridge', 门锁: 'security', 空调: 'ac', 插座: 'socket',
  空气净化器: 'sensor', 窗帘: 'curtain', 洗衣机: 'washer', 电视: 'tv', 音响组: 'speaker', 全部设备: null,
};
const OPERATION_TO_OP: Record<string, string> = {
  开: 'on', 关: 'off', 调亮度: 'brightness', 调色调: 'tone', 调空调温度: 'ac_temp', 调空调模式: 'ac_mode', 调风速: 'ac_wind',
  调冷藏: 'fridge_fresh', 调软冻: 'fridge_soft', 调冷冻: 'fridge_frozen',
};

/** 将「场景+设备类型+操作」意图转为具体设备动作列表 */
function intentsToActions(devices: Device[], intents: AssistantIntent[]): Array<{ device: string; op: string; value?: number | string }> {
  const actions: Array<{ device: string; op: string; value?: number | string }> = [];
  for (const it of intents) {
    const sceneRoom = SCENE_TO_ROOM[it.scene] ?? null;
    const deviceType = DEVICE_TYPE_TO_MAP[it.deviceType] ?? null;
    const op = OPERATION_TO_OP[it.operation] ?? (it.operation === '开' ? 'on' : it.operation === '关' ? 'off' : '');
    if (!op) continue;
    let list = devices;
    if (sceneRoom !== null) list = list.filter(d => d.room === sceneRoom);
    if (deviceType !== null) list = list.filter(d => d.type === deviceType);
    for (const d of list) {
      actions.push({ device: d.name, op, value: it.value ?? undefined });
    }
  }
  return actions;
}

/** 从助手回复中解析 [ACTIONS] 块：支持新格式 intents（场景/设备类型/操作）或旧格式 actions；展示内容中完全移除指令块 */
function parseAssistantReply(reply: string): { displayReply: string; actions: Array<{ device: string; op: string; value?: number | string }>; intents: AssistantIntent[] } {
  const blockRegex = /\[\s*ACTIONS\s*\]([\s\S]*?)\[\s*\/\s*ACTIONS\s*\]/i;
  const match = reply.match(blockRegex);
  let actions: Array<{ device: string; op: string; value?: number | string }> = [];
  let intents: AssistantIntent[] = [];
  const cleaned = (s: string) => s.replace(/```\w*\n?|\n?```/g, '').trim();
  const tryParse = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(cleaned(jsonStr));
      if (Array.isArray(parsed.intents) && parsed.intents.length > 0) {
        intents = (parsed.intents as Array<{ scene?: unknown; deviceType?: unknown; operation?: unknown; value?: unknown }>).map((it): AssistantIntent => {
          const v = it.value;
          const value = v != null && (typeof v === 'number' || typeof v === 'string') ? v : undefined;
          return {
            scene: String(it.scene ?? '全部场景').trim(),
            deviceType: String(it.deviceType ?? '全部设备').trim(),
            operation: String(it.operation ?? '关').trim(),
            value: value ?? null,
          };
        });
        return;
      }
      if (Array.isArray(parsed.actions)) actions = parsed.actions;
    } catch (_) {}
  };
  if (match) tryParse(match[1]);
  if (actions.length === 0 && intents.length === 0) {
    const jsonLike = reply.match(/\{\s*"(intents|actions)"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (jsonLike) tryParse(jsonLike[0]);
  }
  const displayReply = reply.replace(blockRegex, '').replace(/\{\s*"(intents|actions)"\s*:\s*\[[\s\S]*?\]\s*\}/g, '').trim().replace(/\n{2,}/g, '\n') || '已执行。';
  return { displayReply, actions, intents };
}

const AC_MODE_MAP: Record<string, AcMode> = { 制冷: 'cool', 制热: 'heat', 除湿: 'dry', 送风: 'fan', 自动: 'auto', cool: 'cool', heat: 'heat', dry: 'dry', fan: 'fan', auto: 'auto' };
const AC_WIND_MAP: Record<string, AcWindSpeed> = { 低: 'low', 中: 'medium', 高: 'high', 自动: 'auto', low: 'low', medium: 'medium', high: 'high', auto: 'auto' };

const ALL_LIGHTS_ALIASES = ['全屋灯光', '所有灯', '全部灯', '全部灯光', '所有灯光'];

/** 根据助手下发的动作列表更新设备状态 */
function applyAssistantActions(devices: Device[], actions: Array<{ device: string; op: string; value?: number | string }>): Device[] {
  const expandActions: Array<{ device: string; op: string; value?: number | string }> = [];
  for (const a of actions) {
    const deviceName = String(a.device).trim();
    if (ALL_LIGHTS_ALIASES.includes(deviceName) && (a.op === 'on' || a.op === 'off')) {
      devices.filter(d => d.type === 'light').forEach(d => expandActions.push({ device: d.name, op: a.op, value: a.value }));
    } else {
      expandActions.push({ ...a, device: deviceName });
    }
  }
  let next = [...devices];
  for (const a of expandActions) {
    const device = next.find(d => {
      const n = (d.name || '').trim();
      const an = (a.device || '').trim();
      return n === an || n.includes(an) || an.includes(n);
    });
    if (!device) continue;
    const idx = next.findIndex(d => d.id === device.id);
    if (idx < 0) continue;
    const d = next[idx];
    if (a.op === 'on') next[idx] = { ...d, status: true };
    else if (a.op === 'off') next[idx] = { ...d, status: false };
    else if (a.op === 'brightness' && d.type === 'light') {
      const v = typeof a.value === 'number' ? Math.min(4, Math.max(1, a.value)) : 4;
      next[idx] = { ...d, lightBrightness: v, status: true };
    } else if (a.op === 'tone' && d.type === 'light') {
      const v = typeof a.value === 'number' ? Math.min(3, Math.max(1, a.value)) : 2;
      next[idx] = { ...d, lightTone: v };
    } else if (a.op === 'ac_temp' && d.type === 'ac') {
      const v = typeof a.value === 'number' ? Math.min(30, Math.max(16, a.value)) : 24;
      next[idx] = { ...d, acTemperature: v };
    } else if (a.op === 'ac_mode' && d.type === 'ac' && a.value != null) {
      const mode = AC_MODE_MAP[String(a.value)] ?? d.acMode;
      next[idx] = { ...d, acMode: mode };
    } else if (a.op === 'ac_wind' && d.type === 'ac' && a.value != null) {
      const wind = AC_WIND_MAP[String(a.value)] ?? d.acWindSpeed;
      next[idx] = { ...d, acWindSpeed: wind };
    } else if (a.op === 'fridge_fresh' && d.type === 'fridge' && a.value != null) {
      const v = Number(a.value);
      if (!Number.isNaN(v)) next[idx] = { ...d, fridgeTempFresh: Math.min(8, Math.max(2, v)) };
    } else if (a.op === 'fridge_soft' && d.type === 'fridge' && a.value != null) {
      const v = Number(a.value);
      if (!Number.isNaN(v)) next[idx] = { ...d, fridgeTempSoft: Math.min(2, Math.max(-5, v)) };
    } else if (a.op === 'fridge_frozen' && d.type === 'fridge' && a.value != null) {
      const v = Number(a.value);
      if (!Number.isNaN(v)) next[idx] = { ...d, fridgeTempFrozen: Math.min(-12, Math.max(-24, v)) };
    }
  }
  return next;
}

/** 将 AI 返回的已存放时间字符串转为时间戳（当前时间往前推） */
function storedTimeToStoredAt(storedTime: string): number {
  const now = Date.now();
  const s = (storedTime || '0小时').trim();
  const dayMatch = s.match(/(\d+)\s*天/);
  if (dayMatch) return now - Number(dayMatch[1]) * 24 * 3600 * 1000;
  const monthMatch = s.match(/(\d+)\s*月/);
  if (monthMatch) return now - Number(monthMatch[1]) * 30 * 24 * 3600 * 1000;
  const hourMatch = s.match(/(\d+)\s*小时/);
  if (hourMatch) return now - Number(hourMatch[1]) * 3600 * 1000;
  return now;
}

/** 调用大模型分割食材信息：仅保留名字、存量，剔除多余信息，返回结构化列表 */
async function parseIngredientsWithAI(rawText: string): Promise<Array<{ name: string; quantity: string }>> {
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `你是食材信息解析助手。用户输入一段食材相关文字，请按「一条食材一条记录」分割，每条只保留两个字段，多余信息全部剔除：
- name：食材名称（仅名称，如 牛肉、牛奶、西红柿）
- quantity：存量（如 3斤、2瓶、适量、一盒；未说明则写 适量）

不要输出存放时间、备注、标点等任何多余内容。只输出一个 JSON 数组，不要任何其他文字或 markdown。
格式示例：[{"name":"牛肉","quantity":"3斤"},{"name":"牛奶","quantity":"5瓶"}]`,
  };
  const userMsg: ChatMessage = { role: 'user', content: `请把下面内容分割成上述格式的 JSON 数组（只要名字和存量）：\n\n${rawText}` };
  const reply = await chatWithZhipu([systemPrompt, userMsg]);
  const trimmed = reply.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
  let list: Array<{ name?: string; quantity?: string }> = [];
  try {
    list = JSON.parse(jsonStr);
    if (!Array.isArray(list)) list = [];
  } catch (_) {}
  return list
    .map((item: any) => ({
      name: String(item?.name ?? '').trim() || '未命名',
      quantity: String(item?.quantity ?? '适量').trim() || '适量',
    }))
    .filter((item) => item.name !== '未命名');
}

/** 需要持久化的设备字段（状态、灯光、空调、插座、窗帘、电视、洗衣机、音响等） */
type DeviceStateOverrides = Record<string, Partial<Pick<Device, 'status' | 'value' | 'lightBrightness' | 'lightTone' | 'acTemperature' | 'acMode' | 'acWindSpeed' | 'acSwingV' | 'acSwingH' | 'socketOutlets' | 'socketPowerUsage' | 'fridgeTempFresh' | 'fridgeTempSoft' | 'fridgeTempFrozen' | 'fridgeIngredients' | 'curtainOpenPercent' | 'tvVolume' | 'washerProgram' | 'washerStatus' | 'speakerVolume'>>>;

function loadDeviceOrder(deviceIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(DEVICE_ORDER_KEY);
    if (!raw) return deviceIds;
    const stored: string[] = JSON.parse(raw);
    const valid = stored.filter(id => deviceIds.includes(id));
    const rest = deviceIds.filter(id => !valid.includes(id));
    return valid.length ? [...valid, ...rest] : deviceIds;
  } catch {
    return deviceIds;
  }
}

function loadDeviceState(): DeviceStateOverrides {
  try {
    const raw = localStorage.getItem(DEVICE_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getDeviceStateOverrides(devices: Device[]): DeviceStateOverrides {
  const overrides: DeviceStateOverrides = {};
  devices.forEach(d => {
    overrides[d.id] = {
      status: d.status,
      value: d.value,
      lightBrightness: d.lightBrightness,
      lightTone: d.lightTone,
      acTemperature: d.acTemperature,
      acMode: d.acMode,
      acWindSpeed: d.acWindSpeed,
      acSwingV: d.acSwingV,
      acSwingH: d.acSwingH,
      socketOutlets: d.socketOutlets,
      socketPowerUsage: d.socketPowerUsage,
      fridgeTempFresh: d.fridgeTempFresh,
      fridgeTempSoft: d.fridgeTempSoft,
      fridgeTempFrozen: d.fridgeTempFrozen,
      fridgeIngredients: d.fridgeIngredients,
      curtainOpenPercent: d.curtainOpenPercent,
      tvVolume: d.tvVolume,
      washerProgram: d.washerProgram,
      washerStatus: d.washerStatus,
      speakerVolume: d.speakerVolume,
    };
  });
  return overrides;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [v] = a.splice(from, 1);
  a.splice(to, 0, v);
  return a;
}

function loadSceneConfigs(): Record<string, SceneConfig> {
  try {
    const raw = localStorage.getItem(SCENE_CONFIG_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return typeof obj === 'object' && obj !== null ? obj : {};
  } catch {
    return {};
  }
}

function saveSceneConfigs(configs: Record<string, SceneConfig>) {
  try {
    localStorage.setItem(SCENE_CONFIG_KEY, JSON.stringify(configs));
  } catch (_) {}
}

/** 将某场景配置应用到设备列表，返回新设备数组 */
function applyScene(devices: Device[], config: SceneConfig): Device[] {
  const byId = new Map(config.deviceTargets.map(t => [t.deviceId, t]));
  return devices.map(d => {
    const t = byId.get(d.id);
    if (!t) return d;
    const next: Device = { ...d, status: t.status };
    if (d.type === 'light' && t.lightBrightness != null) next.lightBrightness = Math.min(4, Math.max(1, t.lightBrightness));
    if (d.type === 'light' && t.lightTone != null) next.lightTone = Math.min(3, Math.max(1, t.lightTone));
    if (d.type === 'ac' && t.acTemperature != null) next.acTemperature = Math.min(30, Math.max(16, t.acTemperature));
    if (d.type === 'ac' && t.acMode != null) next.acMode = t.acMode;
    if (d.type === 'ac' && t.acWindSpeed != null) next.acWindSpeed = t.acWindSpeed;
    if (d.type === 'fridge' && t.fridgeTempFresh != null) next.fridgeTempFresh = Math.min(8, Math.max(2, t.fridgeTempFresh));
    if (d.type === 'fridge' && t.fridgeTempSoft != null) next.fridgeTempSoft = Math.min(2, Math.max(-5, t.fridgeTempSoft));
    if (d.type === 'fridge' && t.fridgeTempFrozen != null) next.fridgeTempFrozen = Math.min(-12, Math.max(-24, t.fridgeTempFrozen));
    if (d.type === 'socket' && t.socketOutlets != null) next.socketOutlets = t.socketOutlets;
    return next;
  });
}

// --- Components ---

const Button = ({ children, onClick, className = "", variant = "primary" }: any) => {
  const baseStyles = "w-full py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants: any = {
    primary: `bg-[#57C7C3] text-white shadow-lg shadow-[#57C7C3]/20`,
    secondary: `bg-white text-gray-700 border border-gray-200`,
    ghost: `bg-transparent text-[#57C7C3]`,
  };

  return (
    <button onClick={onClick} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

// 中国大陆手机号：1 开头，第二位 3-9，共 11 位数字
const PHONE_REG = /^1[3-9]\d{9}$/;
// 密码：仅大小写字母和数字，最多 20 位
const PASSWORD_REG = /^[a-zA-Z0-9]{0,20}$/;
const isValidPassword = (v: string) => v.length <= 20 && PASSWORD_REG.test(v);

const Input = ({ placeholder, type = "text", icon: Icon, value, onChange, onBlur, error, maxLength }: any) => {
  const isControlled = value !== undefined;
  return (
    <div className="relative mb-4">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
      <input
        type={type}
        placeholder={placeholder}
        {...(isControlled ? { value: value ?? '', onChange } : {})}
        onBlur={onBlur}
        maxLength={maxLength}
        className={`w-full bg-gray-50 border-none rounded-xl py-4 ${Icon ? 'pl-12' : 'px-4'} pr-4 focus:ring-2 focus:ring-[#57C7C3] outline-none transition-all text-gray-700 placeholder:text-gray-400 ${error ? 'ring-2 ring-red-400' : ''}`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

const LIGHT_TONE_LABELS = ['暖光', '自然', '冷光'] as const;
const LIGHT_BRIGHTNESS_LABELS = ['一档', '二档', '三档', '四档'] as const;

const AC_MODE_LABELS: Record<AcMode, string> = { cool: '制冷', heat: '制热', dry: '除湿', fan: '送风', auto: '自动' };
const AC_WIND_LABELS: Record<AcWindSpeed, string> = { low: '低', medium: '中', high: '高', auto: '自动' };
const AC_SWING_V_LABELS: Record<AcSwingV, string> = { up: '上', center: '中', down: '下' };
const AC_SWING_H_LABELS: Record<AcSwingH, string> = { left: '左', center: '中', right: '右' };

type DeviceDetailUpdates = Partial<Pick<Device, 'lightBrightness' | 'lightTone' | 'acTemperature' | 'acMode' | 'acWindSpeed' | 'acSwingV' | 'acSwingH' | 'socketOutlets' | 'socketPowerUsage' | 'fridgeTempFresh' | 'fridgeTempSoft' | 'fridgeTempFrozen' | 'fridgeIngredients' | 'curtainOpenPercent' | 'tvVolume' | 'washerProgram' | 'washerStatus' | 'speakerVolume'>>;

/** 获取指定年月的天数（2月平年28天、闰年29天，3月31天等） */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 生成指定月份每日耗电量（示例数据） */
function getMonthPowerUsage(baseKwh: number, year: number, month: number): { date: Date; usage: number }[] {
  const list: { date: Date; usage: number }[] = [];
  const daysInMonth = getDaysInMonth(year, month);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const seed = d.getTime() % 1000;
    const usage = Number((baseKwh * (0.02 + (seed / 1000) * 0.06)).toFixed(2));
    list.push({ date: d, usage });
  }
  return list;
}

/** 周一为一周第一天：列 0=周一 … 6=周日，与 JS getDay()(0=周日) 换算 */
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
function getMondayFirstColumn(jsDay: number): number {
  return (jsDay + 6) % 7;
}

const PowerCalendarOverlay = ({ powerUsage, onClose }: { powerUsage: number; onClose: () => void }) => {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [atBottom, setAtBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const days = getMonthPowerUsage(powerUsage, year, month);
  const firstDayColumn = getMondayFirstColumn(days[0].date.getDay());
  const padding: null[] = Array(firstDayColumn).fill(null);
  const grid: ({ date: Date; usage: number } | null)[] = [...padding, ...days];
  const rows: ({ date: Date; usage: number } | null)[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    const row = grid.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  const total = days.reduce((s, d) => s + d.usage, 0);
  const canPrev = monthOffset < 1;
  const canNext = monthOffset > 0;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    const threshold = 24;
    setAtBottom(scrollTop + clientHeight >= scrollHeight - threshold);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end sm:justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        className="bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => canPrev && setMonthOffset((m) => m + 1)}
            disabled={!canPrev}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="上月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="flex-1 text-lg font-bold text-gray-900 text-center">{year}年{month}月耗电量</h3>
          <button
            type="button"
            onClick={() => canNext && setMonthOffset((m) => m - 1)}
            disabled={!canNext}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:pointer-events-none"
            aria-label="下月"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 ml-1" aria-label="关闭">
            <span className="text-sm font-medium">关闭</span>
          </button>
        </div>
        <div className="px-4 py-3 text-sm text-gray-500 flex justify-between items-center">
          <span>合计 <span className="font-semibold text-gray-800">{total.toFixed(2)} kWh</span></span>
          <span className="text-gray-400">共{days.length}天</span>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="px-2 pb-8 overflow-y-auto flex-1 min-h-0 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-xs font-medium text-gray-500 py-1">
                {w}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-1">
              {row.map((cell, ci) =>
                cell ? (
                  <div
                    key={ci}
                    className="aspect-square rounded-lg bg-gray-50 border border-gray-100 flex flex-col items-center justify-center p-1"
                  >
                    <span className="text-xs font-medium text-gray-800">{cell.date.getDate()}</span>
                    <span className="text-[10px] text-[#57C7C3] font-medium">{cell.usage} kWh</span>
                  </div>
                ) : (
                  <div key={ci} className="aspect-square" />
                )
              )}
            </div>
          ))}
          <div className="h-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {atBottom && (
                <motion.div
                  key="bottom"
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="px-4 py-2 rounded-full bg-[#57C7C3]/15 text-[#57C7C3] text-xs font-medium"
                >
                  已到底
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DeviceDetailView = ({
  device,
  onBack,
  onToggle,
  onUpdate,
  ingredientLibrary = [],
  onAddToIngredientLibrary,
  onRecordIngredients,
  onRemoveFromIngredientLibrary,
  formatStoredTime,
}: {
  device: Device;
  onBack: () => void;
  onToggle: () => void;
  onUpdate: (updates: DeviceDetailUpdates) => void;
  ingredientLibrary?: FridgeIngredientItem[];
  onAddToIngredientLibrary?: (items: { name: string; quantity?: string }[]) => void;
  onRecordIngredients?: (rawText: string) => Promise<void>;
  onRemoveFromIngredientLibrary?: (id: string) => void;
  formatStoredTime?: (storedAt: number, asOf?: number) => string;
}) => {
  const [showPowerCalendar, setShowPowerCalendar] = useState(false);
  const [showIngredientInput, setShowIngredientInput] = useState(false);
  const [showIngredientTable, setShowIngredientTable] = useState(false);
  const [ingredientTableViewedAt, setIngredientTableViewedAt] = useState(0);
  const [ingredientDraft, setIngredientDraft] = useState('');
  const [ingredientVoiceListening, setIngredientVoiceListening] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const ingredientRecognitionRef = useRef<SpeechRecognition | null>(null);
  const isLight = device.type === 'light';
  const isAc = device.type === 'ac';
  const isSocket = device.type === 'socket';
  const isFridge = device.type === 'fridge';
  const isCurtain = device.type === 'curtain';
  const isTv = device.type === 'tv';
  const isWasher = device.type === 'washer';
  const isSpeaker = device.type === 'speaker';
  const brightness = device.lightBrightness ?? 4;
  const tone = device.lightTone ?? 2;
  const acTemp = device.acTemperature ?? 24;
  const acMode = device.acMode ?? 'cool';
  const acWind = device.acWindSpeed ?? 'medium';
  const acSwingV = device.acSwingV ?? 'center';
  const acSwingH = device.acSwingH ?? 'center';
  const outlets = device.socketOutlets ?? [];
  const powerUsage = device.socketPowerUsage ?? 0;
  const fridgeFresh = device.fridgeTempFresh ?? 4;
  const fridgeSoft = device.fridgeTempSoft ?? -2;
  const fridgeFrozen = device.fridgeTempFrozen ?? -18;
  const curtainOpen = device.curtainOpenPercent ?? 0;
  const tvVol = device.tvVolume ?? 50;
  const washerProgram = device.washerProgram ?? '标准洗';
  const washerStatus = device.washerStatus ?? '已关闭';
  const speakerVol = device.speakerVolume ?? 60;

  const WASHER_PROGRAMS = ['标准洗', '快洗', '羊毛', '强力洗', '漂洗'] as const;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="返回"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 flex-1">{device.name}</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <span className="text-gray-700 font-medium">开关</span>
          <button
            type="button"
            onClick={onToggle}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${device.status ? 'bg-[#57C7C3]' : 'bg-gray-300'}`}
            aria-label={device.status ? '关闭' : '开启'}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${device.status ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {isFridge && (
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setIngredientDraft(device.fridgeIngredients ?? ''); setShowIngredientInput(true); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#57C7C3]/10 text-[#57C7C3] font-medium text-sm hover:bg-[#57C7C3]/20 transition-colors"
              >
                <Mic className="w-5 h-5" />
                一键输入食材信息
              </button>
              <button
                type="button"
                onClick={() => {
                setIngredientTableViewedAt(Date.now());
                setShowIngredientTable(true);
              }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                食材
              </button>
            </div>
            {device.fridgeIngredients && (
              <p className="mt-2 text-xs text-gray-500 break-words">已记录：{device.fridgeIngredients}</p>
            )}
          </div>
        )}

        {isLight && (
          <>
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">亮度</span>
                <span className="text-sm text-gray-500">{LIGHT_BRIGHTNESS_LABELS[brightness - 1]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={brightness}
                onChange={(e) => onUpdate({ lightBrightness: Number(e.target.value) })}
                className="w-full h-2.5 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
              />
            </div>
            <div className="px-5 py-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">色调</span>
                <span className="text-sm text-gray-500">{LIGHT_TONE_LABELS[tone - 1]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={tone}
                onChange={(e) => onUpdate({ lightTone: Number(e.target.value) })}
                className="w-full h-2.5 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
              />
            </div>
          </>
        )}

        {isAc && (
          <>
            <div className="px-5 py-5 border-b border-gray-50 space-y-1">
              <p className="text-base font-semibold text-gray-800">{device.room}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-gray-900">{acTemp}°C</p>
                <p className="text-base font-medium text-gray-700">{AC_MODE_LABELS[acMode]} · 风速 {AC_WIND_LABELS[acWind]}</p>
              </div>
              <p className="text-sm text-gray-500">{device.status ? '运行中' : '已关闭'}</p>
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <span className="text-gray-700 font-medium block mb-2">温度</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={16}
                  max={30}
                  value={acTemp}
                  onChange={(e) => onUpdate({ acTemperature: Number(e.target.value) })}
                  className="flex-1 h-2.5 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
                />
                <span className="text-lg font-bold text-gray-800 w-10">{acTemp}°</span>
              </div>
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <span className="text-gray-700 font-medium block mb-2">模式</span>
              <div className="flex flex-wrap gap-2">
                {(['cool', 'heat', 'dry', 'fan', 'auto'] as AcMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdate({ acMode: m })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${acMode === m ? 'bg-[#57C7C3] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {AC_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <span className="text-gray-700 font-medium block mb-2">风速</span>
              <div className="flex flex-wrap gap-2">
                {(['low', 'medium', 'high', 'auto'] as AcWindSpeed[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onUpdate({ acWindSpeed: w })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${acWind === w ? 'bg-[#57C7C3] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {AC_WIND_LABELS[w]}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4">
              <span className="text-gray-700 font-medium block mb-2">扫风方向（点击对应按钮调节扇叶位置）</span>
              <div className="rounded-2xl p-3">
                <div className="text-center text-sm font-medium text-gray-600 mb-2">空调出风口</div>
                <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto">
                  {(['up', 'center', 'down'] as AcSwingV[]).map((v) =>
                    (['left', 'center', 'right'] as AcSwingH[]).map((h) => (
                      <button
                        key={`${v}-${h}`}
                        type="button"
                        onClick={() => onUpdate({ acSwingV: v, acSwingH: h })}
                        className={`aspect-square rounded-xl transition-all flex items-center justify-center text-sm font-medium ${
                          acSwingV === v && acSwingH === h
                            ? 'bg-[#57C7C3] text-white shadow-md scale-105'
                            : 'bg-white/80 text-gray-500 hover:bg-[#57C7C3]/20 border border-gray-200'
                        }`}
                        title={`${AC_SWING_V_LABELS[v]}${AC_SWING_H_LABELS[h]}`}
                      >
                        {v === 'up' && h === 'left' && '↖'}
                        {v === 'up' && h === 'center' && '↑'}
                        {v === 'up' && h === 'right' && '↗'}
                        {v === 'center' && h === 'left' && '←'}
                        {v === 'center' && h === 'center' && '●'}
                        {v === 'center' && h === 'right' && '→'}
                        {v === 'down' && h === 'left' && '↙'}
                        {v === 'down' && h === 'center' && '↓'}
                        {v === 'down' && h === 'right' && '↘'}
                      </button>
                    ))
                  )}
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">上 · 中 · 下 &nbsp;|&nbsp; 左 · 中 · 右</p>
              </div>
            </div>
          </>
        )}

        {isSocket && (
          <>
            <button
              type="button"
              onClick={() => setShowPowerCalendar(true)}
              className="w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              <span className="text-gray-700 font-medium block mb-1">耗电量</span>
              <p className="text-xl font-bold text-gray-900">{powerUsage.toFixed(2)} kWh</p>
              <p className="text-xs text-gray-500 mt-0.5">今日累计 · 点击查看近一月</p>
            </button>
            <AnimatePresence>
              {showPowerCalendar && (
                <PowerCalendarOverlay
                  key="power-cal"
                  powerUsage={powerUsage}
                  onClose={() => setShowPowerCalendar(false)}
                />
              )}
            </AnimatePresence>
            <div className="px-5 py-4">
              <span className="text-gray-700 font-medium block mb-3">插孔</span>
              <div className="space-y-3">
                {outlets.map((outlet, i) => (
                  <div
                    key={outlet.id}
                    className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-xs text-gray-500 block mb-0.5">插孔 {i + 1}</span>
                      <input
                        type="text"
                        value={outlet.deviceName}
                        onChange={(e) => {
                          const next = outlets.map(o => o.id === outlet.id ? { ...o, deviceName: e.target.value } : o);
                          onUpdate({ socketOutlets: next });
                        }}
                        placeholder="插入的设备名称"
                        className="w-full bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400 outline-none border-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = outlets.map(o => o.id === outlet.id ? { ...o, on: !o.on } : o);
                        onUpdate({ socketOutlets: next });
                      }}
                      className={`flex-shrink-0 w-11 h-6 rounded-full p-1 transition-colors overflow-hidden flex items-center ${outlet.on ? 'bg-[#57C7C3]' : 'bg-gray-300'}`}
                      aria-label={outlet.on ? '关闭插孔' : '开启插孔'}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform flex-shrink-0 ${outlet.on ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {isFridge && (
          <>
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700 font-medium">冷藏室</span>
                <span className="text-lg font-bold text-gray-900">{fridgeFresh}°C</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={fridgeFresh}
                onChange={(e) => onUpdate({ fridgeTempFresh: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
              />
            </div>
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700 font-medium">软冻层</span>
                <span className="text-lg font-bold text-gray-900">{fridgeSoft}°C</span>
              </div>
              <input
                type="range"
                min={-5}
                max={2}
                value={fridgeSoft}
                onChange={(e) => onUpdate({ fridgeTempSoft: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
              />
            </div>
            <div className="px-5 py-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700 font-medium">冷冻室</span>
                <span className="text-lg font-bold text-gray-900">{fridgeFrozen}°C</span>
              </div>
              <input
                type="range"
                min={-24}
                max={-12}
                value={fridgeFrozen}
                onChange={(e) => onUpdate({ fridgeTempFrozen: Number(e.target.value) })}
                className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
              />
            </div>
          </>
        )}

        {isCurtain && (
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 font-medium">开合度</span>
              <span className="text-sm font-medium text-gray-900">{curtainOpen}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={curtainOpen}
              onChange={(e) => onUpdate({ curtainOpenPercent: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">0% 全关 · 100% 全开</p>
          </div>
        )}

        {isTv && (
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 font-medium">音量</span>
              <span className="text-sm font-medium text-gray-900">{tvVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={tvVol}
              onChange={(e) => onUpdate({ tvVolume: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
            />
          </div>
        )}

        {isWasher && (
          <div className="px-5 py-4 border-b border-gray-50 space-y-3">
            <div>
              <span className="text-gray-700 font-medium block mb-2">洗涤程序</span>
              <div className="flex flex-wrap gap-2">
                {WASHER_PROGRAMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdate({ washerProgram: p })}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${washerProgram === p ? 'bg-[#57C7C3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-700 font-medium">状态</span>
              <span className="text-sm text-gray-600">{device.status ? (washerStatus || '运行中') : '已关闭'}</span>
            </div>
          </div>
        )}

        {isSpeaker && (
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 font-medium">音量</span>
              <span className="text-sm font-medium text-gray-900">{speakerVol}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={speakerVol}
              onChange={(e) => onUpdate({ speakerVolume: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3] cursor-pointer"
            />
          </div>
        )}

        {!isLight && !isAc && !isSocket && !isFridge && !isCurtain && !isTv && !isWasher && !isSpeaker && (
          <div className="px-5 py-4 text-sm text-gray-500">
            {device.room} · {device.status ? (device.value || '已开启') : '已关闭'}
          </div>
        )}
      </div>

      {/* 食材信息输入弹窗（仅冰箱） */}
      <AnimatePresence>
        {showIngredientInput && isFridge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end sm:justify-center"
            onClick={() => {
              if (ingredientRecognitionRef.current) { try { ingredientRecognitionRef.current.abort(); } catch (_) {} ingredientRecognitionRef.current = null; setIngredientVoiceListening(false); }
              setShowIngredientInput(false);
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="bg-white rounded-t-3xl max-h-[65vh] flex flex-col shadow-xl min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-gray-900">输入食材信息</h3>
                <button
                  type="button"
                  onClick={() => { if (ingredientRecognitionRef.current) { try { ingredientRecognitionRef.current.abort(); } catch (_) {} ingredientRecognitionRef.current = null; setIngredientVoiceListening(false); } setShowIngredientInput(false); }}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                  aria-label="关闭"
                >
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto min-h-0">
                <textarea
                  value={ingredientDraft}
                  onChange={(e) => setIngredientDraft(e.target.value)}
                  placeholder="打字输入食材，如：牛奶、鸡蛋、西红柿…"
                  className="w-full min-h-[80px] max-h-[28vh] rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#57C7C3] focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
              <div className="px-5 pt-0 pb-[72px] flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (!SR) {
                      setIngredientVoiceListening(false);
                      return;
                    }
                    if (ingredientRecognitionRef.current) {
                      try { ingredientRecognitionRef.current.stop(); } catch (_) {}
                      ingredientRecognitionRef.current = null;
                      setIngredientVoiceListening(false);
                      return;
                    }
                    const recognition = new SR();
                    recognition.lang = 'zh-CN';
                    recognition.continuous = true;
                    recognition.interimResults = false;
                    recognition.onresult = (e: any) => {
                      const t = e.results[e.resultIndex][0].transcript;
                      setIngredientDraft((prev) => (prev ? prev + t : t));
                    };
                    recognition.onend = () => { setIngredientVoiceListening(false); ingredientRecognitionRef.current = null; };
                    recognition.onerror = () => { setIngredientVoiceListening(false); ingredientRecognitionRef.current = null; };
                    try {
                      recognition.start();
                      ingredientRecognitionRef.current = recognition;
                      setIngredientVoiceListening(true);
                    } catch (_) {
                      setIngredientVoiceListening(false);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium text-sm transition-colors ${ingredientVoiceListening ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <Mic className={`w-5 h-5 ${ingredientVoiceListening ? 'animate-pulse' : ''}`} />
                  {ingredientVoiceListening ? '点击结束语音输入' : '语音输入'}
                </button>
                <button
                  type="button"
                  disabled={recordLoading || !ingredientDraft.trim()}
                  onClick={async () => {
                    const text = ingredientDraft.trim();
                    if (!text) return;
                    if (onRecordIngredients) {
                      setRecordLoading(true);
                      try {
                        await onRecordIngredients(text);
                        setIngredientDraft('');
                      } catch (_) {
                        if (onAddToIngredientLibrary) {
                          const parts = text.split(/[、，\n\s]+/).map(s => s.trim()).filter(Boolean);
                          if (parts.length) onAddToIngredientLibrary(parts.map(name => ({ name, quantity: '适量' })));
                          setIngredientDraft('');
                        }
                      } finally {
                        setRecordLoading(false);
                      }
                    } else if (onAddToIngredientLibrary) {
                      const parts = text.split(/[、，\n\s]+/).map(s => s.trim()).filter(Boolean);
                      if (parts.length) onAddToIngredientLibrary(parts.map(name => ({ name, quantity: '适量' })));
                      setIngredientDraft('');
                    }
                  }}
                  className="flex-1 py-4 rounded-xl font-medium text-sm bg-[#57C7C3] text-white hover:bg-[#57C7C3]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {recordLoading ? '整理中…' : '记录'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 食材库表格弹窗（仅冰箱） */}
      <AnimatePresence>
        {showIngredientTable && isFridge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end sm:justify-center"
            onClick={() => setShowIngredientTable(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="bg-white rounded-t-3xl max-h-[calc(100vh-72px)] flex flex-col shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-sm text-gray-900">食材库</h3>
                <button type="button" onClick={() => setShowIngredientTable(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500" aria-label="关闭">
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </button>
              </div>
              <div className="p-4 pb-20 flex-1 overflow-auto min-h-0">
                {ingredientLibrary.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">暂无食材，请在一键输入中录入后点击「记录」</p>
                ) : (
                  <table className="w-full text-xs table-fixed">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                        <th className="py-2.5 pl-4 pr-2 w-[38%]">名字</th>
                        <th className="py-2.5 px-2 w-[24%]">存量</th>
                        <th className="py-2.5 px-2 w-[28%]">已存放时间</th>
                        <th className="py-2.5 pr-4 pl-1 w-[10%] text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientLibrary.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="py-2.5 pl-4 pr-2 font-medium text-gray-900 break-words align-middle">{item.name}</td>
                          <td className="py-2.5 px-2 text-gray-600 break-words align-middle">{item.quantity}</td>
                          <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap align-middle">{formatStoredTime ? formatStoredTime(item.storedAt, ingredientTableViewedAt || undefined) : `${item.storedAt}`}</td>
                          <td className="py-2.5 pr-4 pl-1 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => onRemoveFromIngredientLibrary?.(item.id)}
                              className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              aria-label="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/** 设备列表卡片下方状态文案（家居 App 常见状态展示） */
function getDeviceStatusText(device: Device): string {
  if (!device.status) {
    if (device.type === 'curtain') return '已关闭';
    if (device.type === 'tv') return '已关闭';
    if (device.type === 'washer') return `${device.washerProgram ?? '标准洗'} · 已关闭`;
    if (device.type === 'speaker') return '已关闭';
    if (device.type === 'socket') return '已关闭';
    return device.value || '已关闭';
  }
  if (device.type === 'curtain') {
    const pct = device.curtainOpenPercent ?? 0;
    return pct >= 100 ? '已全开' : pct <= 0 ? '已全关' : `打开 ${pct}%`;
  }
  if (device.type === 'tv') return `已开启 · 音量 ${device.tvVolume ?? 50}%`;
  if (device.type === 'washer') return `${device.washerProgram ?? '标准洗'} · ${device.washerStatus ?? '已关闭'}`;
  if (device.type === 'speaker') return `已开启 · 音量 ${device.speakerVolume ?? 60}%`;
  if (device.type === 'socket') return `已开启 · 今日 ${(device.socketPowerUsage ?? 0).toFixed(2)} kWh`;
  if (device.type === 'sensor') return device.value || '已开启';
  if (device.type === 'light') return `已开启 · ${device.lightBrightness ?? 4}档`;
  if (device.type === 'ac') return `${device.acTemperature ?? 24}°C · ${device.acMode === 'cool' ? '制冷' : device.acMode === 'heat' ? '制热' : '已开启'}`;
  if (device.type === 'security') return '已上锁';
  if (device.type === 'fridge') return `冷藏${device.fridgeTempFresh ?? 4}°C · 冷冻${device.fridgeTempFrozen ?? -18}°C`;
  return device.value || '已开启';
}

const DeviceCard = ({
  device,
  index,
  isDragging,
  onToggle,
  onSelect,
  onReorder,
  dragJustEndedRef,
  onDragStart,
  onDragEnd,
}: {
  device: Device;
  index: number;
  isDragging: boolean;
  onToggle: (id: string) => void;
  onSelect: (device: Device) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  dragJustEndedRef: React.MutableRefObject<boolean>;
  onDragStart: () => void;
  onDragEnd: () => void;
}) => {
  const getIcon = () => {
    switch (device.type) {
      case 'light': return <Lightbulb className="w-6 h-6" />;
      case 'ac': return <Wind className="w-6 h-6" />;
      case 'security': return <ShieldCheck className="w-6 h-6" />;
      case 'sensor': return <Thermometer className="w-6 h-6" />;
      case 'socket': return <Plug className="w-6 h-6" />;
      case 'curtain': return <PanelTopClose className="w-6 h-6" />;
      case 'washer': return <RotateCw className="w-6 h-6" />;
      case 'fridge': return <Refrigerator className="w-6 h-6" />;
      case 'tv': return <Tv className="w-6 h-6" />;
      case 'speaker': return <Speaker className="w-6 h-6" />;
    }
  };

  const handleClick = () => {
    if (dragJustEndedRef.current) return;
    onSelect(device);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    onDragStart();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(fromIndex) || fromIndex === index) return;
    onReorder(fromIndex, index);
  };

  return (
    <motion.div
      layout
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={`p-4 rounded-2xl border transition-all select-none cursor-grab active:cursor-grabbing ${device.status ? 'bg-white border-[#57C7C3] shadow-md' : 'bg-gray-50 border-transparent opacity-80'} ${isDragging ? 'opacity-50' : ''}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl ${device.status ? 'bg-[#57C7C3]/10 text-[#57C7C3]' : 'bg-gray-200 text-gray-500'}`}>
          {getIcon()}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(device.id); }}
          className={`w-10 h-6 rounded-full p-1 transition-colors ${device.status ? 'bg-[#57C7C3]' : 'bg-gray-300'}`}
          aria-label={device.status ? '关闭' : '开启'}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${device.status ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      <div>
        <h3 className={`font-semibold ${device.status ? 'text-gray-900' : 'text-gray-500'}`}>{device.name}</h3>
        <p className="text-xs text-gray-400 mt-1">{device.room} · {getDeviceStatusText(device)}</p>
      </div>
    </motion.div>
  );
};

/** 从设备生成场景目标（当前状态快照） */
function deviceToTarget(d: Device): SceneDeviceTarget {
  const t: SceneDeviceTarget = { deviceId: d.id, status: d.status };
  if (d.type === 'light') {
    t.lightBrightness = d.lightBrightness ?? 4;
    t.lightTone = d.lightTone ?? 2;
  }
  if (d.type === 'ac') {
    t.acTemperature = d.acTemperature ?? 24;
    t.acMode = d.acMode ?? 'cool';
    t.acWindSpeed = d.acWindSpeed ?? 'medium';
  }
  if (d.type === 'fridge') {
    t.fridgeTempFresh = d.fridgeTempFresh ?? 4;
    t.fridgeTempSoft = d.fridgeTempSoft ?? -2;
    t.fridgeTempFrozen = d.fridgeTempFrozen ?? -18;
  }
  if (d.type === 'socket' && d.socketOutlets) t.socketOutlets = d.socketOutlets.map(o => ({ ...o }));
  return t;
}

/** 根据场景名称描述，返回该场景的默认设备配置（未保存过时使用） */
function getDefaultSceneConfig(sceneId: string, devices: Device[]): SceneConfig {
  const byName = (name: string) => devices.find(d => d.name === name);
  const add = (name: string, status: boolean, overrides?: Partial<SceneDeviceTarget>): void => {
    const d = byName(name);
    if (!d) return;
    const t = deviceToTarget(d);
    targets.push({ ...t, status, ...overrides });
  };
  const targets: SceneDeviceTarget[] = [];

  if (sceneId === '1') {
    // 离家模式：关灯、关空调、关电视音响、关窗帘，门锁保持开启(已锁)，关净化器、插座
    add('客厅大灯', false);
    add('走廊灯', false);
    add('卧室空调', false);
    add('智能门锁', true);
    add('空气净化器', false);
    add('客厅插座', false);
    add('主卧窗帘', false);
    add('电视', false);
    add('音响组', false);
  } else if (sceneId === '2') {
    // 回家模式：开走廊灯、客厅灯、门锁、净化器，开窗帘
    add('走廊灯', true);
    add('客厅大灯', true);
    add('智能门锁', true);
    add('空气净化器', true);
    add('主卧窗帘', true);
  } else if (sceneId === '3') {
    // 观影模式：客厅灯调暗，关走廊灯，开电视和音响，关窗帘
    add('客厅大灯', true, { lightBrightness: 1, lightTone: 1 });
    add('走廊灯', false);
    add('电视', true);
    add('音响组', true);
    add('主卧窗帘', false);
  } else if (sceneId === '4') {
    // 睡眠模式：关客厅和走廊灯，开卧室空调(26°C 制冷)，关窗帘、电视、音响、净化器
    add('客厅大灯', false);
    add('走廊灯', false);
    add('卧室空调', true, { acTemperature: 26, acMode: 'cool', acWindSpeed: 'medium' });
    add('主卧窗帘', false);
    add('电视', false);
    add('音响组', false);
    add('空气净化器', false);
  }

  return { sceneId, deviceTargets: targets };
}

const AC_MODE_KEYS = Object.keys(AC_MODE_LABELS) as AcMode[];
const AC_WIND_KEYS = Object.keys(AC_WIND_LABELS) as AcWindSpeed[];

function SceneEditView({
  scene,
  devices,
  initialConfig,
  onSave,
  onRun,
  onBack,
}: {
  scene: Scene;
  devices: Device[];
  initialConfig: SceneConfig | undefined;
  onSave: (config: SceneConfig) => void;
  onRun: (config: SceneConfig) => void;
  onBack: () => void;
}) {
  const [config, setConfig] = useState<SceneConfig>(() =>
    initialConfig ?? { sceneId: scene.id, deviceTargets: [] }
  );

  const [showAddDevice, setShowAddDevice] = useState(false);

  const getTarget = (deviceId: string) => config.deviceTargets.find(t => t.deviceId === deviceId);
  const setTarget = (deviceId: string, upd: SceneDeviceTarget | null) => {
    if (!upd) {
      setConfig(prev => ({ ...prev, deviceTargets: prev.deviceTargets.filter(t => t.deviceId !== deviceId) }));
      return;
    }
    setConfig(prev => {
      const idx = prev.deviceTargets.findIndex(t => t.deviceId === deviceId);
      const next = [...prev.deviceTargets];
      if (idx >= 0) next[idx] = upd;
      else next.push(upd);
      return { ...prev, deviceTargets: next };
    });
  };

  /** 当前场景已包含的设备（用于展示列表，未加入的隐藏） */
  const includedDevices = config.deviceTargets
    .map(t => devices.find(d => d.id === t.deviceId))
    .filter((d): d is Device => !!d);
  /** 可添加的设备（尚未加入本场景） */
  const addableDevices = devices.filter(d => !config.deviceTargets.some(t => t.deviceId === d.id));

  const handleAddDevice = (d: Device) => {
    setTarget(d.id, deviceToTarget(d));
    setShowAddDevice(false);
  };

  const handleSave = () => {
    onSave(config);
    onBack();
  };

  const handleRun = () => {
    onRun(config);
    onBack();
  };

  return (
    <div className="pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600" aria-label="返回">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${scene.color}`}>
          {scene.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg">{scene.name}</h2>
          <p className="text-xs text-gray-400">配置并执行场景</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">选择要控制的设备</span>
          <button
            type="button"
            onClick={() => setShowAddDevice(true)}
            className="w-8 h-8 rounded-full bg-[#57C7C3] text-white flex items-center justify-center text-lg leading-none hover:bg-[#57C7C3]/90 transition-colors"
            aria-label="添加设备"
          >
            +
          </button>
        </div>
        {includedDevices.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            暂无设备，点击右侧「+」添加要控制的设备
          </div>
        )}
        {includedDevices.map((d) => {
          const target = getTarget(d.id)!;
          return (
            <div key={d.id} className="border-b border-gray-50 last:border-b-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.room}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setTarget(d.id, { ...target, status: !target.status })}
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${target.status ? 'bg-[#57C7C3]' : 'bg-gray-300'}`}
                    aria-label={target.status ? '关闭' : '开启'}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${target.status ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTarget(d.id, null)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="从场景移除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {target && d.type === 'light' && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>亮度</span>
                    <span>{LIGHT_BRIGHTNESS_LABELS[(target.lightBrightness ?? 4) - 1]}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={target.lightBrightness ?? 4}
                    onChange={(e) => setTarget(d.id, { ...target, lightBrightness: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>色调</span>
                    <span>{LIGHT_TONE_LABELS[(target.lightTone ?? 2) - 1]}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={target.lightTone ?? 2}
                    onChange={(e) => setTarget(d.id, { ...target, lightTone: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                </div>
              )}
              {d.type === 'ac' && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>温度</span>
                    <span>{target.acTemperature ?? 24}°C</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={30}
                    value={target.acTemperature ?? 24}
                    onChange={(e) => setTarget(d.id, { ...target, acTemperature: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {AC_MODE_KEYS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTarget(d.id, { ...target, acMode: m })}
                        className={`px-2 py-1 rounded text-xs ${(target.acMode ?? 'cool') === m ? 'bg-[#57C7C3] text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {AC_MODE_LABELS[m]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AC_WIND_KEYS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setTarget(d.id, { ...target, acWindSpeed: w })}
                        className={`px-2 py-1 rounded text-xs ${(target.acWindSpeed ?? 'medium') === w ? 'bg-[#57C7C3] text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {AC_WIND_LABELS[w]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {d.type === 'fridge' && (
                <div className="px-4 pb-3 space-y-2 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>冷藏</span>
                    <span>{target.fridgeTempFresh ?? 4}°C</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={target.fridgeTempFresh ?? 4}
                    onChange={(e) => setTarget(d.id, { ...target, fridgeTempFresh: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                  <div className="flex justify-between">
                    <span>软冻</span>
                    <span>{target.fridgeTempSoft ?? -2}°C</span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={2}
                    value={target.fridgeTempSoft ?? -2}
                    onChange={(e) => setTarget(d.id, { ...target, fridgeTempSoft: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                  <div className="flex justify-between">
                    <span>冷冻</span>
                    <span>{target.fridgeTempFrozen ?? -18}°C</span>
                  </div>
                  <input
                    type="range"
                    min={-24}
                    max={-12}
                    value={target.fridgeTempFrozen ?? -18}
                    onChange={(e) => setTarget(d.id, { ...target, fridgeTempFrozen: +e.target.value })}
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-[#57C7C3]"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddDevice && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end sm:justify-center"
          onClick={() => setShowAddDevice(false)}
        >
          <div
            className="bg-white rounded-t-3xl max-h-[70vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">添加设备</span>
              <button type="button" onClick={() => setShowAddDevice(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="关闭">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {addableDevices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">暂无可添加的设备</p>
              ) : (
                addableDevices.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleAddDevice(d)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.room}</p>
                    </div>
                    <span className="text-[#57C7C3] text-sm">添加</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 py-3 rounded-xl font-medium bg-white border border-gray-200 text-gray-700"
        >
          保存设置
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={config.deviceTargets.length === 0}
          className="flex-1 py-3 rounded-xl font-medium bg-[#57C7C3] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          执行场景
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>('login');
  const [activeTab, setActiveTab] = useState<Tab>('devices');
  const [tabScrollTops, setTabScrollTops] = useState<Record<Tab, number>>({ devices: 0, scenes: 0, assistant: 0, profile: 0 });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [devices, setDevices] = useState<Device[]>(() => {
    const saved = loadDeviceState();
    return INITIAL_DEVICES.map(d => ({ ...d, ...saved[d.id] }));
  });
  const [deviceOrder, setDeviceOrder] = useState<string[]>(() =>
    loadDeviceOrder(INITIAL_DEVICES.map(d => d.id))
  );
  const ingredientLibraryReducer = (state: FridgeIngredientItem[], action: { type: 'ADD'; items: FridgeIngredientItem[] } | { type: 'REMOVE'; id: string }) => {
    if (action.type === 'ADD') return [...state, ...action.items];
    if (action.type === 'REMOVE') return state.filter((x) => x.id !== action.id);
    return state;
  };
  const [ingredientLibrary, dispatchIngredientLibrary] = useReducer(ingredientLibraryReducer, [], () => loadIngredientLibrary());
  const dragJustEndedRef = useRef(false);
  const [draggedDeviceIndex, setDraggedDeviceIndex] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const scrollDirectionRef = useRef<number>(0);
  const scrollRAFRef = useRef<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('全部');
  const roomScrollRef = useRef<HTMLDivElement>(null);
  const roomDragRef = useRef({ startX: 0, startScrollLeft: 0 });
  const roomBarJustDraggedRef = useRef(false);
  const [roomBarDragging, setRoomBarDragging] = useState(false);
  const ROOM_OPTIONS = ['全部', '客厅', '卧室', '次卧', '厨房', '浴室'];
  const orderedDevices = deviceOrder
    .map(id => devices.find(d => d.id === id))
    .filter((d): d is Device => Boolean(d));
  const filteredDevices = selectedRoom === '全部'
    ? orderedDevices
    : orderedDevices.filter(d => d.room === selectedRoom || (selectedRoom === '卧室' && d.room === '主卧'));
  const [loginAccount, setLoginAccount] = useState('');
  const [loginAccountError, setLoginAccountError] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPasswordError, setLoginPasswordError] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPhoneError, setRegisterPhoneError] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordError, setRegisterPasswordError] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [registerPasswordConfirmError, setRegisterPasswordConfirmError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToTermsShake, setAgreedToTermsShake] = useState(false);
  const [agreedToTermsError, setAgreedToTermsError] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const assistantListRef = useRef<HTMLDivElement>(null);
  const [sceneConfigs, setSceneConfigs] = useState<Record<string, SceneConfig>>(loadSceneConfigs);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const sendAssistantMessage = async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    setAssistantMessages((prev) => [...prev, userMsg]);
    setAssistantInput('');
    setAssistantError(null);
    setAssistantLoading(true);
    try {
      const deviceContext = buildDeviceContext(devices);
      const systemPrompt: ChatMessage = {
        role: 'system',
        content: `你是智能家居语音助手。用户发来的每句话，你必须先做「严格分类」，再决定是直接执行还是先追问用户。

【执行条件】只有同时满足以下三类信息齐全时，才可输出 [ACTIONS] 并执行：
一、场景（必选其一）：客厅、卧室、次卧、厨房、浴室、玄关、走廊、全部场景
二、设备类型（必选其一）：灯、冰箱、门锁、空调、插座、空气净化器、窗帘、洗衣机、电视、音响组、全部设备
三、操作（必选其一）：开、关、调亮度、调色调、调空调温度、调空调模式、调风速、调冷藏、调软冻、调冷冻
需要数值时在 value 里填数字（如调亮度 1–4、调空调温度 16–30、调冷藏 2–8、调软冻 -5–2、调冷冻 -24–-12）。

【三类齐全时直接执行】若场景、设备类型、操作三类信息都已明确，则直接输出简短确认语并在末尾输出 [ACTIONS]，不要再多问或追问，直接执行即可。

【缺信息时才追问】仅当用户明显想控制设备但缺少场景、设备类型或操作中的任意一类或两类时，才回复一句追问，引导用户补全信息。例如：
- 用户说「关闭灯光」→ 缺场景 → 回复：「请问您是要关闭哪个场景的灯光呢？例如：客厅、卧室、走廊或全屋。」
- 用户说「把客厅的关掉」→ 缺设备类型 → 回复：「请问您要关闭客厅的哪个设备呢？例如：灯、空调、电视等。」
- 用户说「客厅的灯」→ 缺操作 → 回复：「请问您要对客厅的灯做什么操作呢？例如：打开或关闭，或调节亮度/色调。」
- 用户说「关一下」→ 缺场景和设备 → 回复：「请问您要关闭哪个场景的哪个设备呢？」
追问时语气友好、简洁，一次只问缺的那一类（或最多两类），并给出可选示例方便用户回答。

当前设备列表（仅供参考房间与类型）：
${deviceContext}

【deviceType 必须与用户所说一致】用户说了具体设备类型（如电视、灯、空调、插座）时，deviceType 必须填该类型，不能省略或填「全部设备」。若填成全部设备，后台会误操作该场景下所有设备。例如用户说「关闭客厅电视」时，必须填 deviceType: "电视"，这样只会关客厅的电视；若漏填或填「全部设备」，会错误关闭客厅所有设备。

【输出格式】仅当三类信息都明确时，在回复末尾追加下面这一块（用户不可见），否则不要输出 [ACTIONS]：
[ACTIONS]
{"intents":[{"scene":"场景枚举","deviceType":"设备类型枚举","operation":"操作枚举","value":数值或null}]}
[/ACTIONS]

示例：三类齐全时直接输出确认并带 [ACTIONS]，勿再追问；缺信息时才追问。
- 「关闭客厅电视」→ scene="客厅", deviceType="电视", operation="关"（只关电视，勿填全部设备）
- 「关闭全屋灯光」→ scene="全部场景", deviceType="灯", operation="关"
- 「打开客厅的灯」→ scene="客厅", deviceType="灯", operation="开"
- 「把卧室空调调到26度」→ scene="卧室", deviceType="空调", operation="调空调温度", value=26
- 「关闭灯光」→ 缺场景 → 只回复追问，不输出 [ACTIONS]`,
      };
      // 限制历史条数，避免上下文过长时 API 从前面截断导致系统提示词被裁掉；保证首条始终是 system
      const maxHistory = 6;
      const recentHistory = assistantMessages.slice(-maxHistory);
      const messagesToSend: ChatMessage[] = [systemPrompt, ...recentHistory, userMsg];
      const reply = await chatWithZhipu(messagesToSend);
      const { displayReply, actions, intents } = parseAssistantReply(reply);
      const resolvedActions = intents.length > 0 ? intentsToActions(devices, intents) : actions;
      if (resolvedActions.length > 0) {
        flushSync(() => setDevices(prev => applyAssistantActions(prev, resolvedActions)));
      }
      setAssistantMessages((prev) => [...prev, { role: 'assistant', content: displayReply }]);
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : '请求失败，请稍后重试');
    } finally {
      setAssistantLoading(false);
    }
    setTimeout(() => assistantListRef.current?.scrollTo({ top: assistantListRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const toggleDevice = (id: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id !== id) return d;
      const next = { ...d, status: !d.status };
      if (d.type === 'curtain') next.curtainOpenPercent = next.status ? 100 : 0;
      if (d.type === 'washer') next.washerStatus = next.status ? '洗涤中' : '已关闭';
      return next;
    }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(DEVICE_ORDER_KEY, JSON.stringify(deviceOrder));
    } catch (_) {}
  }, [deviceOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(DEVICE_STATE_KEY, JSON.stringify(getDeviceStateOverrides(devices)));
    } catch (_) {}
  }, [devices]);

  useEffect(() => {
    try {
      localStorage.setItem(INGREDIENT_LIBRARY_KEY, JSON.stringify(ingredientLibrary));
    } catch (_) {}
  }, [ingredientLibrary]);

  useEffect(() => {
    saveSceneConfigs(sceneConfigs);
  }, [sceneConfigs]);

  const handleReorderDevice = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const filteredIds = filteredDevices.map(d => d.id);
    const newFilteredIds = arrayMove(filteredIds, fromIndex, toIndex);
    setDeviceOrder(prev => {
      const next: string[] = [];
      let j = 0;
      for (const id of prev) {
        if (filteredIds.includes(id)) {
          next.push(newFilteredIds[j++]);
        } else {
          next.push(id);
        }
      }
      return next;
    });
    dragJustEndedRef.current = true;
    setTimeout(() => { dragJustEndedRef.current = false; }, 150);
  };

  const handleTabClick = (nextTab: Tab) => {
    if (mainRef.current) {
      setTabScrollTops(prev => ({ ...prev, [activeTab]: mainRef.current!.scrollTop }));
    }
    setActiveTab(nextTab);
  };

  useEffect(() => {
    if (view !== 'home') return;
    const top = tabScrollTops[activeTab] ?? 0;
    requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = top;
    });
  }, [activeTab, view, tabScrollTops]);

  // 切回 AI 助手 Tab 时，聊天区域自动滚到底部
  useEffect(() => {
    if (view !== 'home' || activeTab !== 'assistant') return;
    const el = assistantListRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
  }, [activeTab, view]);

  const dragScrollTick = () => {
    const el = mainRef.current;
    const dir = scrollDirectionRef.current;
    if (el && dir !== 0) {
      const step = 2;
      if (dir === -1 && el.scrollTop > 0) {
        el.scrollTop = Math.max(0, el.scrollTop - step);
      } else if (dir === 1 && el.scrollTop + el.clientHeight < el.scrollHeight) {
        el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + step);
      }
    }
    if (scrollDirectionRef.current !== 0 && mainRef.current) {
      scrollRAFRef.current = requestAnimationFrame(dragScrollTick);
    } else {
      scrollRAFRef.current = null;
    }
  };

  const handleMainDragOver = (e: React.DragEvent) => {
    if (!isDraggingRef.current || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const edge = 72;
    const y = e.clientY;
    if (y < rect.top + edge) scrollDirectionRef.current = -1;
    else if (y > rect.bottom - edge) scrollDirectionRef.current = 1;
    else scrollDirectionRef.current = 0;
    if (scrollDirectionRef.current !== 0 && !scrollRAFRef.current) {
      scrollRAFRef.current = requestAnimationFrame(dragScrollTick);
    }
  };

  const handleDeviceDragStart = (index: number) => {
    isDraggingRef.current = true;
    setDraggedDeviceIndex(index);
  };

  const handleDeviceDragEnd = () => {
    setDraggedDeviceIndex(null);
    isDraggingRef.current = false;
    scrollDirectionRef.current = 0;
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = null;
    }
  };

  useEffect(() => {
    if (!roomBarDragging) return;
    const onMove = (e: MouseEvent) => {
      const el = roomScrollRef.current;
      if (!el) return;
      const dx = roomDragRef.current.startX - e.clientX;
      if (Math.abs(dx) > 5) roomBarJustDraggedRef.current = true;
      el.scrollLeft = Math.max(0, roomDragRef.current.startScrollLeft + dx);
    };
    const onUp = () => setRoomBarDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [roomBarDragging]);

  const renderLogin = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-white px-8 pt-24 pb-12 flex flex-col"
    >
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">欢迎回来</h1>
        <p className="text-gray-500">登录您的智能家居账号</p>
      </div>

      <div className="flex-1">
        <Input
          placeholder="手机号 / 邮箱"
          value={loginAccount}
          maxLength={11}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            setLoginAccount(val);
            if (loginAccountError) setLoginAccountError('');
          }}
          onBlur={() => {
            const v = loginAccount.trim();
            if (v && !PHONE_REG.test(v)) setLoginAccountError('输入有误');
            else setLoginAccountError('');
          }}
          error={loginAccountError}
        />
        <Input
          placeholder="密码"
          type="password"
          value={loginPassword}
          maxLength={20}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setLoginPassword(e.target.value);
            if (loginPasswordError) setLoginPasswordError('');
          }}
          onBlur={() => {
            if (loginPassword && !isValidPassword(loginPassword)) setLoginPasswordError('输入有误');
            else setLoginPasswordError('');
          }}
          error={loginPasswordError}
        />
        
        <div className="flex justify-end mb-8">
          <button className="text-sm text-[#57C7C3] font-medium">忘记密码？</button>
        </div>

        <Button
          onClick={() => {
            const account = loginAccount.trim();
            if (!account || !PHONE_REG.test(account)) {
              setLoginAccountError('输入有误');
              return;
            }
            if (loginPassword && !isValidPassword(loginPassword)) {
              setLoginPasswordError('输入有误');
              return;
            }
            setView('home');
          }}
        >
          登录
        </Button>
        
        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-gray-100"></div>
          <span className="text-xs text-gray-400 uppercase tracking-widest">其他方式</span>
          <div className="flex-1 h-[1px] bg-gray-100"></div>
        </div>

        <div className="mt-8 flex justify-center">
          <button type="button" className="px-6 py-3 rounded-full border border-gray-100 text-gray-500 text-sm font-medium hover:text-[#57C7C3] hover:border-[#57C7C3]/50 transition-colors cursor-pointer">
            其他登录方式
          </button>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          还没有账号？ 
          <button onClick={() => setView('register')} className="text-[#57C7C3] font-bold ml-1">立即注册</button>
        </p>
      </div>
    </motion.div>
  );

  const renderRegister = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-white px-8 pt-24 pb-12 flex flex-col"
    >
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">创建账号</h1>
        <p className="text-gray-500">开启您的智慧生活之旅</p>
      </div>

      <div className="flex-1">
        <Input
          placeholder="手机号"
          value={registerPhone}
          maxLength={11}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            setRegisterPhone(val);
            if (registerPhoneError) setRegisterPhoneError('');
          }}
          onBlur={() => {
            const v = registerPhone.trim();
            if (v && !PHONE_REG.test(v)) setRegisterPhoneError('输入有误');
            else setRegisterPhoneError('');
          }}
          error={registerPhoneError}
        />
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="6位验证码"
              value={registerCode}
              maxLength={6}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setRegisterCode(val);
              }}
            />
          </div>
          <button className="h-[56px] px-4 text-sm font-medium text-[#57C7C3] bg-[#57C7C3]/10 rounded-xl">获取验证码</button>
        </div>
        <div className="mb-4">
          <Input
            placeholder="设置密码"
            type="password"
            value={registerPassword}
            maxLength={20}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
              setRegisterPassword(val);
              if (registerPasswordError) setRegisterPasswordError('');
            }}
            onBlur={() => {
              if (registerPassword && !isValidPassword(registerPassword)) setRegisterPasswordError('输入有误');
              else setRegisterPasswordError('');
            }}
            error={registerPasswordError}
          />
          <p className="mt-1 text-sm text-gray-500">密码最多20位，由大小写字母与数字组成</p>
        </div>
        <Input
          placeholder="确认密码"
          type="password"
          value={registerPasswordConfirm}
          maxLength={20}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
            setRegisterPasswordConfirm(val);
            if (registerPasswordConfirmError) setRegisterPasswordConfirmError('');
          }}
          onBlur={() => {
            if (registerPasswordConfirm && !isValidPassword(registerPasswordConfirm)) setRegisterPasswordConfirmError('输入有误');
            else setRegisterPasswordConfirmError('');
          }}
          error={registerPasswordConfirmError}
        />

        <motion.div
          className={`flex items-start gap-3 mb-8 p-3 rounded-xl transition-colors ${agreedToTermsError ? 'bg-red-50 ring-2 ring-red-400' : ''}`}
          animate={agreedToTermsShake ? { x: [0, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          onAnimationComplete={() => setAgreedToTermsShake(false)}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => {
              setAgreedToTerms(e.target.checked);
              setAgreedToTermsError(false);
              setAgreedToTermsShake(false);
            }}
            className="mt-1 rounded text-[#57C7C3] focus:ring-[#57C7C3] cursor-pointer"
          />
          <p className="text-xs text-gray-500 leading-relaxed">
            我已阅读并同意 <span className="text-[#57C7C3]">《用户注册协议》</span> 和 <span className="text-[#57C7C3]">《隐私协议》</span>
          </p>
        </motion.div>

        <Button
          onClick={() => {
            if (!agreedToTerms) {
              setAgreedToTermsError(true);
              setAgreedToTermsShake(true);
              return;
            }
            if (registerPassword && !isValidPassword(registerPassword)) {
              setRegisterPasswordError('输入有误');
              return;
            }
            if (registerPasswordConfirm && !isValidPassword(registerPasswordConfirm)) {
              setRegisterPasswordConfirmError('输入有误');
              return;
            }
            if (registerPassword !== registerPasswordConfirm) {
              setRegisterPasswordConfirmError('两次密码不一致');
              return;
            }
            setView('home');
          }}
        >
          注册并登录
        </Button>
      </div>

      <div className="text-center">
        <button onClick={() => setView('login')} className="text-sm text-gray-500">
          已有账号？ <span className="text-[#57C7C3] font-bold">返回登录</span>
        </button>
      </div>
    </motion.div>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-8 pb-6 bg-white flex justify-between items-center">
        <div>
          <h2 className="text-sm text-gray-400 font-medium">早上好, 张先生</h2>
          <h1 className="text-2xl font-bold text-gray-900">我的家</h1>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#57C7C3] flex items-center justify-center text-white">
            <Plus className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main ref={mainRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6 pb-16" onDragOver={handleMainDragOver}>
        <AnimatePresence mode="wait">
          {activeTab === 'devices' && (
            <motion.div 
              key="devices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6"
            >
              {selectedDeviceId && (() => {
                const selectedDevice = devices.find(d => d.id === selectedDeviceId);
                return selectedDevice ? (
                  <DeviceDetailView
                    device={selectedDevice}
                    onBack={() => setSelectedDeviceId(null)}
                    onToggle={() => toggleDevice(selectedDeviceId)}
                    onUpdate={(updates) => setDevices(prev => prev.map(d => d.id === selectedDeviceId ? { ...d, ...updates } : d))}
                    ingredientLibrary={ingredientLibrary}
                    onAddToIngredientLibrary={(items) => dispatchIngredientLibrary({ type: 'ADD', items: items.map((item, i) => ({ id: `${Date.now()}-${i}`, name: item.name, quantity: item.quantity ?? '适量', storedAt: Date.now() })) })}
                    onRecordIngredients={async (rawText) => {
                      const list = await parseIngredientsWithAI(rawText);
                      const nextItems = list.map((item, i) => ({
                        id: `${Date.now()}-${i}`,
                        name: item.name,
                        quantity: item.quantity,
                        storedAt: storedTimeToStoredAt('0小时'),
                      }));
                      flushSync(() => dispatchIngredientLibrary({ type: 'ADD', items: nextItems }));
                    }}
                    onRemoveFromIngredientLibrary={(id) => dispatchIngredientLibrary({ type: 'REMOVE', id })}
                    formatStoredTime={formatStoredTime}
                  />
                ) : null;
              })()}
              {!selectedDeviceId && (
                <>
                  <div className="relative -mx-4 px-3 w-full max-w-[446px] mx-auto min-w-0">
                    <div 
                      ref={roomScrollRef}
                      onMouseDown={(e) => {
                        if (roomScrollRef.current) {
                          roomDragRef.current = { startX: e.clientX, startScrollLeft: roomScrollRef.current.scrollLeft };
                          setRoomBarDragging(true);
                        }
                      }}
                      className={`flex gap-4 overflow-x-auto overflow-y-hidden pb-6 no-scrollbar scroll-smooth pr-4 w-full min-w-0 select-none ${roomBarDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}
                    >
                      {ROOM_OPTIONS.map((room) => (
                        <button 
                          key={room}
                          type="button"
                          onClick={() => {
                            if (roomBarJustDraggedRef.current) {
                              roomBarJustDraggedRef.current = false;
                              return;
                            }
                            setSelectedRoom(room);
                          }}
                          className={`flex-shrink-0 px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedRoom === room ? 'bg-[#57C7C3] text-white' : 'bg-white text-gray-500 shadow-sm'}`}
                        >
                          {room}
                        </button>
                      ))}
                      <div className="flex-shrink-0 w-4" aria-hidden />
                    </div>
                    <div className="pointer-events-none absolute right-0 top-0 bottom-6 w-8 bg-gradient-to-l from-gray-50 to-transparent" aria-hidden />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {filteredDevices.map((device, index) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        index={index}
                        isDragging={draggedDeviceIndex === index}
                        onToggle={toggleDevice}
                        onSelect={(d) => setSelectedDeviceId(d.id)}
                        onReorder={handleReorderDevice}
                        dragJustEndedRef={dragJustEndedRef}
                        onDragStart={() => handleDeviceDragStart(index)}
                        onDragEnd={handleDeviceDragEnd}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'scenes' && (
            <motion.div 
              key="scenes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6"
            >
              {selectedSceneId ? (() => {
                const scene = selectedSceneId === 'custom' ? CUSTOM_SCENE : SCENES.find(s => s.id === selectedSceneId);
                if (!scene) return null;
                const saved = sceneConfigs[scene.id];
                const effectiveConfig = scene.id === 'custom'
                  ? (saved ?? { sceneId: 'custom', deviceTargets: [] })
                  : (saved?.deviceTargets?.length ? saved : getDefaultSceneConfig(scene.id, devices));
                return (
                  <SceneEditView
                    scene={scene}
                    devices={devices}
                    initialConfig={effectiveConfig}
                    onSave={(config) => setSceneConfigs(prev => ({ ...prev, [config.sceneId]: config }))}
                    onRun={(config) => setDevices(prev => applyScene(prev, config))}
                    onBack={() => setSelectedSceneId(null)}
                  />
                );
              })() : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {SCENES.map(scene => {
                      const saved = sceneConfigs[scene.id];
                      const effectiveConfig = saved?.deviceTargets?.length ? saved : getDefaultSceneConfig(scene.id, devices);
                      const count = effectiveConfig.deviceTargets.length;
                      return (
                        <motion.div
                          whileTap={{ scale: 0.98 }}
                          key={scene.id}
                          onClick={() => setSelectedSceneId(scene.id)}
                          className="bg-white p-5 rounded-3xl shadow-sm flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${scene.color}`}>
                              {scene.icon}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{scene.name}</h3>
                              <p className="text-xs text-gray-400 mt-1">
                                {count > 0 ? `控制 ${count} 个设备` : '点击配置设备'}
                              </p>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:text-[#57C7C3] transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSceneId('custom')}
                    className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 font-medium flex items-center justify-center gap-2 hover:border-[#57C7C3] hover:text-[#57C7C3] transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    自定义场景
                  </button>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'assistant' && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6 flex flex-col flex-1 min-h-0 w-full"
            >
              <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#57C7C3]/10 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#57C7C3]" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">AI 语音助手</h2>
                  <p className="text-xs text-gray-400">基于智谱大模型，可文字对话</p>
                </div>
              </div>
              <div
                ref={assistantListRef}
                className="flex-1 overflow-y-auto min-h-[200px] space-y-4 mb-4"
              >
                {assistantMessages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">输入问题发送，例如：客厅的灯怎么关？</p>
                )}
                {assistantMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#57C7C3] text-white'
                          : 'bg-white border border-gray-100 shadow-sm text-gray-800'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {assistantLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-2.5 text-sm text-gray-500">
                      正在思考…
                    </div>
                  </div>
                )}
                {assistantError && (
                  <p className="text-sm text-red-500 px-2">{assistantError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendAssistantMessage()}
                  placeholder="输入消息…"
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#57C7C3] focus:border-transparent"
                  disabled={assistantLoading}
                />
                <button
                  type="button"
                  onClick={sendAssistantMessage}
                  disabled={assistantLoading || !assistantInput.trim()}
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#57C7C3] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6"
            >
              <div className="bg-white rounded-3xl p-6 shadow-sm mb-6 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden">
                  <img src="https://picsum.photos/seed/user/200" alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">张先生</h3>
                  <p className="text-xs text-gray-400">ID: 88293012</p>
                </div>
                <button className="p-2 text-gray-400"><Settings className="w-5 h-5" /></button>
              </div>

              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                {[
                  { icon: <Smartphone className="w-5 h-5" />, label: '家庭管理' },
                  { icon: <ShieldCheck className="w-5 h-5" />, label: '安全中心' },
                  { icon: <Bell className="w-5 h-5" />, label: '消息通知' },
                  { icon: <LayoutGrid className="w-5 h-5" />, label: '第三方服务' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-5 ${i !== 3 ? 'border-bottom border-gray-50' : ''} cursor-pointer hover:bg-gray-50 transition-colors`}>
                    <div className="flex items-center gap-4">
                      <div className="text-gray-400">{item.icon}</div>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setView('login')}
                className="mt-8 w-full py-4 rounded-2xl bg-red-50 text-red-500 font-bold flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                退出登录
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-2 flex justify-between items-center z-50">
        <TabButton 
          active={activeTab === 'devices'} 
          onClick={() => handleTabClick('devices')} 
          icon={<Smartphone />} 
          label="设备" 
        />
        <TabButton 
          active={activeTab === 'scenes'} 
          onClick={() => handleTabClick('scenes')} 
          icon={<LayoutGrid />} 
          label="场景" 
        />
        <TabButton 
          active={activeTab === 'assistant'} 
          onClick={() => handleTabClick('assistant')} 
          icon={<Mic />} 
          label="AI助手" 
        />
        <TabButton 
          active={activeTab === 'profile'} 
          onClick={() => handleTabClick('profile')} 
          icon={<User />} 
          label="我的" 
        />
      </nav>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-hidden relative font-sans">
      <AnimatePresence mode="wait">
        {view === 'login' && renderLogin()}
        {view === 'register' && renderRegister()}
        {view === 'home' && renderHome()}
      </AnimatePresence>
    </div>
  );
}

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-0.5 transition-all ${active ? 'text-[#57C7C3]' : 'text-gray-400'}`}
  >
    <motion.div 
      animate={active ? { scale: 1.05, y: -1 } : { scale: 1, y: 0 }}
      className="p-0.5"
    >
      {React.cloneElement(icon, { className: "w-5 h-5" })}
    </motion.div>
    <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {active && (
      <motion.div 
        layoutId="tab-indicator"
        className="w-1 h-0.5 bg-[#57C7C3] rounded-full"
      />
    )}
  </button>
);
