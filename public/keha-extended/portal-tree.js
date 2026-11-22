(() => {
  'use strict';
  const config=document.documentElement.dataset;
  if(!config.branchPortal&&!config.shlomoKeha)return;
  const I=window.FamilyI18n;
  const name=()=>I.isEnglish?config.branchNameEn:config.nakashName;
  const tr=(he,en)=>I.isEnglish?en:he;
  const dialog=document.getElementById('extendedKehaDialog');
  let returnFocus=null;
  for(const trigger of document.querySelectorAll('[data-extended-open]')){
    trigger.querySelector('[data-extended-label]').textContent=trigger.dataset.extendedOpen==='footer'
      ?tr('לאתר קהא המורחבת','Visit extended Keha')
      :tr('לאתר משפחת קהא המורחבת','The extended Keha family site');
  }
  if(dialog){
    const labels=[
      ['#extendedKehaTitle','קהא המורחבת','The extended Keha family'],
      ['[data-extended-intro]','איך תרצו לפתוח את אתר המשפחה?','How would you like to open the family site?'],
      ['[data-extended-install-title]','התקנת האתר במסך הבית','Add the site to your home screen'],
      ['[data-extended-install-note]','קיצור ישיר לאתר קהא המורחבת','A shortcut to the extended Keha family site'],
      ['[data-extended-visit-title]','מעבר לאתר','Visit the site'],
      ['[data-extended-visit-note]','לכל ענפי משפחת קהא המורחבת','Explore all branches of the extended family'],
    ];
    for(const [selector,he,en] of labels)dialog.querySelector(selector).textContent=tr(he,en);
    dialog.querySelector('[data-extended-close]').setAttribute('aria-label',tr('סגירה','Close'));
    if(['he','en-US','en-GB'].includes(I.language))for(const link of dialog.querySelectorAll('a')){
      const url=new URL(link.getAttribute('href'));url.searchParams.set('lang',I.language);link.href=url.href;
    }
    document.addEventListener('click',event=>{
      const trigger=event.target.closest('[data-extended-open]');
      if(trigger){
        event.preventDefault();returnFocus=trigger;
        const mobile=document.getElementById('mobileNavDialog');
        if(mobile?.open){mobile.close();returnFocus=document.getElementById('mobileMenuToggle');}
        const desktop=document.getElementById('desktopMenuDropdown');
        if(desktop&&!desktop.hidden){
          desktop.hidden=true;document.getElementById('desktopMenuToggle').setAttribute('aria-expanded','false');
          if(desktop.contains(trigger))returnFocus=document.getElementById('desktopMenuToggle');
        }
        if(!dialog.open)dialog.showModal();
      }else if(event.target.closest('[data-extended-close]'))dialog.close();
    });
    dialog.addEventListener('close',()=>returnFocus?.focus());
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
    });
    document.addEventListener('DOMContentLoaded',()=>{
      for(const id of ['homeTiles','mobileMenuTiles','desktopMenuTiles']){
        const tree=document.querySelector('#'+id+' .home-tile-tree');if(!tree)continue;
        const tile=document.createElement('button');tile.type='button';tile.className='home-tile home-tile-extended';
        tile.dataset.extendedOpen='menu';tile.setAttribute('aria-haspopup','dialog');tile.setAttribute('aria-controls',dialog.id);
        tile.innerHTML='<span class="home-tile-icon" aria-hidden="true"><img src="/keha-extended/brand.svg" alt="" width="32" height="32"></span><span><strong>'+tr('לאתר משפ׳ קהא המורחבת','Extended Keha family')+'</strong><small>'+tr('מעבר לאתר או התקנה במסך הבית','Visit the site or add it to your home screen')+'</small></span>';
        tree.after(tile);
      }
    });
  }
  if(!config.branchPortal)return;

  function zechariahPhoneFamilies(){
    const data=window.FAMILY_DATA;
    // The first three top buttons match the right-hand column of the tree.
    // Boaz's household opens independently and remains connected to his parents.
    const columns={
      right:[
        ['kadya',"מש' קדיה מזרחי",'Kadya Mizrahi family','#8c5728'],
        ['saadia',"מש' סעדיה קהא",'Saadia Keha family','#266e63'],
        ['shalom',"מש' שלום קהא",'Shalom Keha family','#365f88'],
      ],
      left:[
        ['boaz',"מש' בועז קהא",'Boaz Keha family','#795486'],
        ['aharon',"מש' אהרון חובשי",'Aharon Hovshi family','#99485b'],
      ],
    };
    const branches=Object.entries(columns).flatMap(([side,items])=>items.map(([key,title,titleEn,color],row)=>{
      const unit='u-saadia-'+key;
      return {unit,id:data.units[unit].branch,title,titleEn,color,side,row,solo:key==='aharon'};
    }));
    document.getElementById('branchBar').setAttribute('role','group');

    function layout({world,nodes,connectors,viewportWidth,textScale,personCard}){
      const width=Math.max(280,Math.min(480,viewportWidth-4)),inset=4,gutter=26;
      const column=(width-2*inset-gutter)/2,middle=width/2;
      world.style.width=width+'px';
      const fragment=document.createDocumentFragment(),cards=new Map(),rows=[];

      function addCard(unit,branch){
        const card=document.createElement('div');
        card.className='tree-unit phone-family-card';
        card.dataset.unit=branch?unit.id:'u-root';
        const members=branch?.solo?unit.people.slice(0,1):unit.people;
        const cardWidth=branch?column:Math.min(width,208*textScale);
        const left=branch?(branch.side==='right'?middle+gutter/2:inset):middle-cardWidth/2;
        card.style.width=cardWidth+'px';card.style.left=left+'px';
        card.style.setProperty('--family-members',members.length);
        card.innerHTML=members.map(id=>personCard(id,unit)).join('');
        fragment.append(card);
        const center=left+cardWidth/2;
        const personX=members.length===1?center:center+(I.isEnglish?-1:1)*(cardWidth+3)/4;
        const item={card,center,personX};
        cards.set(unit.id,item);
        if(branch)(rows[branch.row]??=[]).push(item);
      }
      addCard(data.units[data.root]);
      for(const branch of branches)addCard(data.units[branch.unit],branch);
      nodes.replaceChildren(fragment);

      function place(item,y){
        item.card.style.top=y+'px';item.top=y;
        item.bottom=y+(item.card.offsetHeight||64*textScale);
        return item.bottom;
      }
      const start=place(cards.get(data.root),2);
      let bottom=start;
      for(const row of rows){
        const top=bottom+24*textScale;
        bottom=Math.max(...row.map(item=>place(item,top)));
      }
      const height=bottom+12*textScale;
      world.style.height=height+'px';
      connectors.setAttribute('width',width);connectors.setAttribute('height',height);
      connectors.replaceChildren();
      function path(d){
        const line=document.createElementNS('http://www.w3.org/2000/svg','path');
        line.setAttribute('d',d);connectors.append(line);
        return line;
      }
      const junction=item=>item.top-10*textScale;
      const direct=branches.filter(branch=>data.units[branch.unit].parent===data.root);
      path('M'+middle+' '+start+'V'+Math.max(...direct.map(branch=>junction(cards.get(branch.unit)))));
      for(const branch of branches){
        const unit=data.units[branch.unit],item=cards.get(unit.id),parent=cards.get(unit.parent);
        if(!parent)continue;
        const joint=junction(item),lane=middle+(branch.side==='left'?-1:1)*gutter/3;
        const from=unit.parent===data.root?'M'+middle+' '+joint:
          'M'+parent.center+' '+parent.bottom+'v'+7*textScale+'H'+lane+'V'+joint;
        const line=path(from+'H'+item.personX+'V'+(item.top-1));
        line.setAttribute('stroke',branch.color);
        line.dataset.parentUnit=unit.parent;line.dataset.childUnit=unit.id;
        line.dataset.childPerson=unit.people[0];
        if(unit.parentage==='adopted')line.setAttribute('stroke-dasharray','3 3');
      }
      return {width,height};
    }
    return {branches,layout};
  }
  window.FamilyExtendedKeha={
    title:name,
    phoneFamilies:config.branchPortal==='zechariah'?zechariahPhoneFamilies():null,
    renderTree(state){
      // Each single-family portal opens its full tree directly.
      if(window.FAMILY_DATA.branches.length===1&&state.branch==='all')state.mode='full';
      document.getElementById('workspaceTitle').textContent=tr('האילן המשפחתי','Family tree');
      document.getElementById('mobileViewTitle').textContent=name();
      return false;
    },
  };
})();
