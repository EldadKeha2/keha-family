// Keep references to the same checked files and upload receipts. Only editor
// values are reversible. Saving to the album starts a new history.
export function createSegmentHistory(owner) {
  const past = [], future = [];
  let gesture = null;
  function snapshot(time) {
    return {time,index:owner.index,split:owner.split,nextNumber:owner.nextNumber,
      entries:owner.segments.map(draft => ({draft,segment:{...draft.segment},
        metadata:structuredClone(draft.metadata),eventChosen:draft.eventChosen}))};
  }
  function same(a,b) {
    return a.time === b.time && a.index === b.index && a.split === b.split && a.nextNumber === b.nextNumber &&
      a.entries.length === b.entries.length && a.entries.every((entry,i) => {
        const other = b.entries[i];
        return entry.draft === other.draft && entry.eventChosen === other.eventChosen &&
          JSON.stringify(entry.segment) === JSON.stringify(other.segment) && JSON.stringify(entry.metadata) === JSON.stringify(other.metadata);
      });
  }
  return {
    record(time,group) {
      if (!owner.split || owner.saving || (group && group === gesture)) return;
      gesture = group;
      past.push(snapshot(time));
      if (past.length > 120) past.shift();
      future.length = 0;
    },
    endGesture() { gesture = null; },
    clear() { past.length = future.length = 0; gesture = null; },
    move(redo,time) {
      const from = redo ? future : past, to = redo ? past : future, current = snapshot(time);
      gesture = null;
      let state;
      do { state = from.pop(); } while (state && same(state,current));
      if (!state) return null;
      to.push(current);
      for (const {draft,segment,metadata,eventChosen} of state.entries) {
        Object.assign(draft,{segment,metadata,eventChosen});
      }
      owner.segments.splice(0,owner.segments.length,...state.entries.map(entry => entry.draft));
      owner.split = state.split;
      owner.drafts = state.split ? owner.segments : [owner.original];
      owner.index = state.index;
      owner.nextNumber = state.nextNumber;
      return state;
    }
  };
}
