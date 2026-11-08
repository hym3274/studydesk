import { describe, expect, it } from 'vitest';
import { initialPosition, makeMove, newGame, resign, undoMove } from './engine/game';
import { defaultPreferences, deserializeSession, loadSession, SAVE_KEY, saveSession, serializeSession, type StoragePort } from './persistence';
const session = () => ({ game: newGame(), preferences: defaultPreferences });
const memory = (): StoragePort => {
  const data = new Map<string,string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key,value) => { data.set(key,value); } };
};
describe('保存と復元', () => {
  it('捕獲と成りを含む棋譜を合法性検証付きで復元し、待ったも使える', () => {
    let game = newGame();
    for (const [from,to,promote] of [[56,47,false],[24,33,false],[64,16,true]] as const) game = makeMove(game,{type:'move',from,to,promote});
    const s = {game,preferences:{flipped:true,faceToFace:false}}, loaded = deserializeSession(serializeSession(s));
    expect(loaded).toEqual(s); expect(loaded.game.position.hands.sente.B).toBe(1);
    expect(undoMove(loaded.game).history).toHaveLength(2);
  });
  it('投了の復元、初期局面と設定の復元', () => {
    expect(deserializeSession(serializeSession({...session(),game:resign(newGame())})).game.result?.reason).toBe('resign');
    expect(deserializeSession(serializeSession(session())).game.position).toEqual(initialPosition());
  });
  it('データ未保存なら新規対局', () => { expect(loadSession(memory()).status).toBe('new'); });
  it('保存と読み取りを同じキーで行う', () => {
    const storage = memory(); expect(saveSession(storage,session())).toBe(true);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull(); expect(loadSession(storage).status).toBe('restored');
  });
  it('壊れたJSON、未知のバージョン、不正な手順や設定を拒否', () => {
    const raw = serializeSession(session()), data = JSON.parse(raw);
    const invalid = ['{', 'null', '[]', JSON.stringify({...data,version:2}),JSON.stringify({...data,moves:[{type:'drop',kind:'K',to:40}]}),
      JSON.stringify({...data,moves:[{type:'move',from:18,to:27,promote:false}]}), JSON.stringify({...data,preferences:{}}),JSON.stringify({...data,key:'tampered'}),
      JSON.stringify({...data,ending:'win'}),JSON.stringify({...data,moves:[{type:'move',from:54,to:99,promote:false}]}),
      JSON.stringify({...data,moves:Array(2049).fill({})})];
    for (const text of invalid) expect(() => deserializeSession(text)).toThrow();
    const storage = memory(); storage.setItem(SAVE_KEY,'{'); expect(loadSession(storage).status).toBe('invalid');
  });
  it('ストレージ非対応・読み取り禁止・容量超過でもゲームを続けられる', () => {
    const blocked: StoragePort = { getItem() {throw new Error('blocked');}, setItem() {throw new Error('quota');} };
    expect(loadSession(blocked).status).toBe('unavailable'); expect(loadSession(null).status).toBe('unavailable');
    expect(saveSession(blocked,session())).toBe(false); expect(saveSession(null,session())).toBe(false);
    expect(makeMove(loadSession(blocked).game,{type:'move',from:54,to:45,promote:false}).history).toHaveLength(1);
  });
});
