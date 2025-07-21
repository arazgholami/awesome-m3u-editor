let m3uData = [];
let selectedGroup = null;
let selectedItems = new Set();
let selectedGroupItems = [];
let renamingGroup = null;
let renamingItemIndex = null;

const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const groupsList = document.getElementById('groupsList');
const itemsList = document.getElementById('itemsList');
const itemDetailsForm = document.getElementById('itemDetailsForm');
const sortItemsBtn = document.getElementById('sortItemsBtn');
const clearBtn = document.getElementById('clearBtn');

const itemGroupTitleDropdown = document.getElementById('itemGroupTitleDropdown');
const itemGroupTitleDropdownMenu = document.getElementById('itemGroupTitleDropdownMenu');
const itemGroupTitleSelected = document.getElementById('itemGroupTitleSelected');
const itemGroupTitleInput = document.getElementById('itemGroupTitle');

const itemIndexInput = document.getElementById('itemIndex');
const itemNameInput = document.getElementById('itemName');
const itemUrlInput = document.getElementById('itemUrl');
const itemTvgIdInput = document.getElementById('itemTvgId');
const itemTvgNameInput = document.getElementById('itemTvgName');
const itemTvgLogoInput = document.getElementById('itemTvgLogo');

const groupsFilterInput = document.getElementById('groupsFilterInput');
const itemsFilterInput = document.getElementById('itemsFilterInput');
let groupsFilterValue = '';
let itemsFilterValue = '';
groupsFilterInput.addEventListener('input', (e) => {
    groupsFilterValue = e.target.value.toLowerCase();
    renderGroups();
});
itemsFilterInput.addEventListener('input', (e) => {
    itemsFilterValue = e.target.value.toLowerCase();
    renderItems();
});

const groupsSortable = new Sortable(groupsList, {
    animation: 150,
    onStart: function(evt) {
        const groupName = evt.item.textContent.split(' (')[0];
        if (selectedItems.size > 1 && selectedItems.has(groupName)) {
            evt.item.classList.add('dragging-selected');
        } else {
            selectedItems.clear();
            selectedItems.add(groupName);
        }
    },
    onEnd: function(evt) {
        evt.item.classList.remove('dragging-selected');
        updateGroupsOrder(evt);
        renderGroups();
    },
    onChoose: function(evt) {
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        } else if (document.selection) {
            document.selection.empty();
        }
    }
});

function getGroupIndex(groupName) {
    const groups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    return groups.indexOf(groupName);
}

const itemsSortable = new Sortable(itemsList, {
    animation: 150,
    onStart: function(evt) {
        
        if (selectedItems.size > 1 && selectedItems.has(evt.oldIndex)) {
            
            evt.item.classList.add('dragging-selected');
        } else {
            
            selectedItems.clear();
            selectedItems.add(evt.oldIndex);
        }
    },
    onEnd: function(evt) {
        evt.item.classList.remove('dragging-selected');
        updateItemsOrder(evt);
        
        
        renderItems();
    },
    onChoose: function(evt) {
        
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        } else if (document.selection) {
            document.selection.empty();
        }
    }
});

fileInput.addEventListener('change', handleFileUpload);
downloadBtn.addEventListener('click', downloadM3U);
itemDetailsForm.addEventListener('submit', saveItemChanges);
sortItemsBtn.addEventListener('click', sortItemsAlphabetically);
document.getElementById('newItemBtn').addEventListener('click', createNewItem);
document.getElementById('newGroupBtn').addEventListener('click', () => {
    const groups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    let newGroupName = 'New Group';
    let suffix = 1;
    while (groups.includes(newGroupName)) {
        newGroupName = `New Group ${suffix++}`;
    }
    
    m3uData.unshift({
        name: '',
        url: '',
        tvgId: '',
        tvgName: '',
        tvgLogo: '',
        groupTitle: newGroupName,
        duration: '-1',
        attributes: {}
    });
    renamingGroup = newGroupName;
    selectedGroup = newGroupName;
    saveToLocalStorage();
    renderGroups();
});

document.getElementById('deleteGroupsBtn').addEventListener('click', deleteSelectedGroups);
document.getElementById('deleteItemsBtn').addEventListener('click', deleteSelectedItems);
clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
});

const moveItemsBtn = document.getElementById('moveItemsBtn');
const groupDropdown = document.getElementById('groupDropdown');

function updateItemsOrder(evt) {
    if (!selectedGroup) return;

    let selectedIndices = Array.from(selectedItems);
    let selectedItemsData = selectedIndices.map(i => selectedGroupItems[i]);

    if (selectedItems.size <= 1) {
        selectedIndices = [evt.oldIndex];
        selectedItemsData = [selectedGroupItems[evt.oldIndex]];
    }

    const remainingItems = selectedGroupItems.filter((_, i) => !selectedIndices.includes(i));

    let insertAt = evt.newIndex;
    if (evt.oldIndex < evt.newIndex) {
        insertAt = evt.newIndex - selectedIndices.filter(i => i < evt.newIndex).length + 1;
    }

    const newOrder = [
        ...remainingItems.slice(0, insertAt),
        ...selectedItemsData,
        ...remainingItems.slice(insertAt)
    ];

    m3uData = m3uData.filter(item => item.groupTitle !== selectedGroup);
    m3uData = [...m3uData, ...newOrder];

    selectedItems.clear();
    for (let i = 0; i < selectedItemsData.length; i++) {
        selectedItems.add(insertAt + i);
    }

    renderItems();
    saveToLocalStorage();
}

function updateGroupDropdown() {
    const groups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    groupDropdown.innerHTML = '';

    groups.forEach(group => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item';
        a.href = '#';
        a.textContent = group;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            moveSelectedItemsToGroup(group);
        });
        li.appendChild(a);
        groupDropdown.appendChild(li);
    });

    moveItemsBtn.disabled = selectedItems.size === 0 || groupDropdown.children.length === 0;
}


function moveSelectedItemsToGroup(targetGroup) {
    if (selectedItems.size === 0 || !selectedGroup) return;

    
    
    const selectedItemIndices = Array.from(selectedItems);
    const itemsToMove = selectedItemIndices.map(index => selectedGroupItems[index]).filter(Boolean);

    
    itemsToMove.forEach(item => {
        item.groupTitle = targetGroup;
    });

    
    selectedItems.clear();

    
    saveToLocalStorage();
    renderGroups();
    renderItems();
    updateDeleteButtonsState();

    
    alert(`Moved ${itemsToMove.length} item(s) to "${targetGroup}"`);
}

function createNewItem() {
    if (!selectedGroup) {
        alert('Please select a group first');
        return;
    }
    
    
    const newItem = {
        name: 'New Item',
        url: '',
        tvgId: '',
        tvgName: '',
        tvgLogo: '',
        groupTitle: selectedGroup,
        duration: '-1',
        attributes: {}
    };
    
    
    m3uData.unshift(newItem);
    
    
    saveToLocalStorage();
    renderItems();
    
    
    selectItem({}, 0);
    
    
    setTimeout(() => {
        document.getElementById('itemName').focus();
        document.getElementById('itemName').select();
    }, 100);
}

function updateDeleteButtonsState() {
    const hasSelection = selectedItems.size > 0;
    document.getElementById('deleteGroupsBtn').disabled = !hasSelection;
    document.getElementById('deleteItemsBtn').disabled = !hasSelection || !selectedGroup;
    moveItemsBtn.disabled = !hasSelection || !selectedGroup || groupDropdown.children.length === 0;
}

function deleteSelectedGroups() {
    if (selectedItems.size === 0) return;
    
    if (!confirm(`Delete ${selectedItems.size} selected group(s)? This will also delete all items in these groups.`)) {
        return;
    }
    
    
    const allGroups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    
    
    const remainingGroups = allGroups.filter(group => !selectedItems.has(group));
    const newData = [];
    
    remainingGroups.forEach(group => {
        const groupItems = m3uData.filter(item => item.groupTitle === group);
        newData.push(...groupItems);
    });
    
    m3uData = newData;
    
    
    selectedItems.clear();
    selectedGroup = null;
    
    
    renderGroups();
    itemsList.innerHTML = '';
    itemDetailsForm.reset();
    saveToLocalStorage();
    updateDeleteButtonsState();
}

function deleteSelectedItems() {
    if (selectedItems.size === 0 || !selectedGroup) return;
    
    
    const indicesToDelete = Array.from(selectedItems).sort((a, b) => b - a);
    
    
    const groupItems = m3uData.filter(item => item.groupTitle === selectedGroup);
    
    
    indicesToDelete.forEach(index => {
        const itemToDelete = groupItems[index];
        if (itemToDelete) {
            const itemIndex = m3uData.findIndex(item => item === itemToDelete);
            if (itemIndex !== -1) {
                m3uData.splice(itemIndex, 1);
            }
        }
    });
    
    
    selectedItems.clear();
    
    
    renderItems();
    itemDetailsForm.reset();
    saveToLocalStorage();
    updateDeleteButtonsState();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        parseM3U(content);
        renderGroups();
        downloadBtn.disabled = false;
    };
    reader.readAsText(file);
}

function parseM3U(content) {
    m3uData = [];
    const lines = content.split('\n');
    let currentItem = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF')) {
            currentItem = { rawExtinf: line };
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupTitleMatch = line.match(/group-title="([^"]*)"/);
            
            currentItem.tvgId = tvgIdMatch ? tvgIdMatch[1] : '';
            currentItem.tvgName = tvgNameMatch ? tvgNameMatch[1] : '';
            currentItem.tvgLogo = tvgLogoMatch ? tvgLogoMatch[1] : '';
            currentItem.groupTitle = groupTitleMatch ? groupTitleMatch[1] : 'No Group';
            
            
            const nameMatch = line.match(/,(.*)$/);
            currentItem.name = nameMatch ? nameMatch[1].trim() : 'Unnamed';
        } else if (currentItem && !line.startsWith('#')) {
            currentItem.url = line.trim();
            m3uData.push(currentItem);
            currentItem = null;
        }
    }
    
    saveToLocalStorage();
}

function renderGroups() {
    let groups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    if (groupsFilterValue) {
        groups = groups.filter(g => g.toLowerCase().includes(groupsFilterValue));
    }
    groupsList.innerHTML = '';

    
    updateGroupDropdown();
    updateItemGroupTitleDropdown(itemGroupTitleInput.value);

    groups.forEach((group, idx) => {
        const groupItem = document.createElement('div');
        groupItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        if (renamingGroup === group) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = group;
            input.className = 'form-control form-control-sm d-inline-block';
            input.style.width = '70%';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveGroupRename(group, input.value);
            });
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-sm btn-success ms-1';
            saveBtn.textContent = 'Save';
            saveBtn.onclick = () => saveGroupRename(group, input.value);
            groupItem.appendChild(input);
            groupItem.appendChild(saveBtn);
            setTimeout(() => { input.focus(); input.select(); }, 50);
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.textContent = group;
            const countSpan = document.createElement('span');
            countSpan.className = 'badge bg-secondary ms-2';
            countSpan.textContent = m3uData.filter(item => item.groupTitle === group).length;
            groupItem.appendChild(nameSpan);
            groupItem.appendChild(countSpan);
            groupItem.addEventListener('click', (e) => selectGroup(e, group, idx));
            groupItem.addEventListener('dblclick', () => {
                renamingGroup = group;
                renderGroups();
            });
            
            if (selectedItems.has(group)) {
                groupItem.classList.add('selected');
            }
            
            if (selectedGroup === group) {
                groupItem.classList.add('active');
            }
        }
        groupsList.appendChild(groupItem);
    });

    if (groups.length > 0 && !selectedGroup) {
        selectGroup(null, groups[0], 0);
    }
}

function selectGroup(event, groupName, groupIdx) {
    const groupDisplayName = groupName.split(' (')[0];
    const items = Array.from(groupsList.children);
    let idx = groupIdx;
    if (typeof idx !== 'number') {
        idx = items.findIndex(item => item.textContent.split(' (')[0] === groupDisplayName);
    }

    if (event && event.ctrlKey) {
        
        if (selectedItems.has(groupDisplayName)) {
            selectedItems.delete(groupDisplayName);
        } else {
            selectedItems.add(groupDisplayName);
        }
        
        items.forEach((item, i) => {
            const itemGroupName = item.textContent.split(' (')[0];
            item.classList.toggle('selected', selectedItems.has(itemGroupName));
            
            item.classList.toggle('active', i === idx && selectedItems.has(groupDisplayName));
        });
        updateDeleteButtonsState();
        return;
    } else if (event && event.shiftKey) {
        
        const activeIdx = items.findIndex(item => item.classList.contains('active'));
        const endIdx = idx;
        const [start, end] = [Math.min(activeIdx, endIdx), Math.max(activeIdx, endIdx)];
        
        selectedItems.clear();
        for (let i = start; i <= end; i++) {
            const itemGroupName = items[i].textContent.split(' (')[0];
            selectedItems.add(itemGroupName);
        }
        
        items.forEach((item, i) => {
            const itemGroupName = item.textContent.split(' (')[0];
            item.classList.toggle('selected', selectedItems.has(itemGroupName));
            item.classList.toggle('active', i === activeIdx);
        });
        updateDeleteButtonsState();
        return;
    }

    
    selectedItems.clear();
    selectedItems.add(groupDisplayName);
    selectedGroup = groupDisplayName;
    
    items.forEach((item, i) => {
        const itemGroupName = item.textContent.split(' (')[0];
        item.classList.toggle('selected', selectedItems.has(itemGroupName));
        item.classList.toggle('active', i === idx);
    });
    renderItems();
    updateDeleteButtonsState();
}

function renderItems() {
    if (!selectedGroup) {
        
        updateGroupDropdown();
        return;
    }
    
    selectedGroupItems = m3uData.filter(item => item.groupTitle === selectedGroup);
    if (itemsFilterValue) {
        selectedGroupItems = selectedGroupItems.filter(item => (item.name || '').toLowerCase().includes(itemsFilterValue));
    }
    itemsList.innerHTML = '';
    
    selectedGroupItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'list-group-item d-flex justify-content-between align-items-center';
        if (renamingItemIndex === index) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item.name || 'Unnamed';
            input.className = 'form-control form-control-sm d-inline-block';
            input.style.width = '70%';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveItemRename(index, input.value);
            });
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-sm btn-success ms-1';
            saveBtn.textContent = 'Save';
            saveBtn.onclick = () => saveItemRename(index, input.value);
            itemElement.appendChild(input);
            itemElement.appendChild(saveBtn);
            setTimeout(() => { input.focus(); input.select(); }, 50);
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name || 'Unnamed';
            const urlSpan = document.createElement('span');
            urlSpan.className = 'text-muted ms-2';
            let url = item.url || '';
            if (url.length > 32) url = url.slice(0, 29) + '...';
            urlSpan.textContent = url;
            urlSpan.style.maxWidth = '160px';
            urlSpan.style.overflow = 'hidden';
            urlSpan.style.textOverflow = 'ellipsis';
            urlSpan.style.whiteSpace = 'nowrap';
            itemElement.appendChild(nameSpan);
            itemElement.appendChild(urlSpan);
            itemElement.dataset.index = index;
            itemElement.addEventListener('click', (e) => selectItem(e, index));
            itemElement.addEventListener('dblclick', () => {
                renamingItemIndex = index;
                renderItems();
            });
            
            if (selectedItems.has(index)) {
                itemElement.classList.add('selected');
            }
        }
        itemsList.appendChild(itemElement);
    });
}

function selectItem(event, index) {
    const item = selectedGroupItems[index];
    if (!item) return;
    
    if (event.ctrlKey) {
        
        const itemElement = event.target;
        itemElement.classList.toggle('selected');
        if (itemElement.classList.contains('selected')) {
            selectedItems.add(index);
        } else {
            selectedItems.delete(index);
        }
        updateDeleteButtonsState();
        return;
    } else if (event.shiftKey) {
        
        const items = Array.from(itemsList.children);
        const startIndex = items.findIndex(item => item.classList.contains('active'));
        const endIndex = index;
        
        const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
        
        for (let i = start; i <= end; i++) {
            items[i].classList.add('selected');
            selectedItems.add(i);
        }
        updateDeleteButtonsState();
        return;
    }
    
    
    selectedItems.clear();
    selectedItems.add(index);
    
    
    Array.from(itemsList.children).forEach((el, i) => {
        el.classList.toggle('active', i === index);
        el.classList.toggle('selected', selectedItems.has(i));
    });
    
    
    itemIndexInput.value = index;
    itemNameInput.value = item.name || '';
    itemUrlInput.value = item.url || '';
    itemTvgIdInput.value = item.tvgId || '';
    itemTvgNameInput.value = item.tvgName || '';
    itemTvgLogoInput.value = item.tvgLogo || '';
    updateItemGroupTitleDropdown(item.groupTitle || '');
    updateItemUrlPreview(item.url || '');
    
    updateDeleteButtonsState();
}

function saveItemChanges(e) {
    e.preventDefault();
    
    const index = parseInt(itemIndexInput.value);
    if (isNaN(index) || index < 0 || index >= selectedGroupItems.length) return;
    
    const item = selectedGroupItems[index];
    
    
    item.name = itemNameInput.value;
    item.url = itemUrlInput.value;
    item.tvgId = itemTvgIdInput.value;
    item.tvgName = itemTvgNameInput.value;
    item.tvgLogo = itemTvgLogoInput.value;
    
    const oldGroup = item.groupTitle;
    item.groupTitle = itemGroupTitleInput.value;
    
    
    const globalIndex = m3uData.findIndex(i => i === selectedGroupItems[index]);
    if (globalIndex !== -1) {
        m3uData[globalIndex] = { ...item };
    }
    
    
    if (oldGroup !== item.groupTitle) {
        selectedGroup = item.groupTitle;
        renderGroups();
    } else {
        renderItems();
    }
    
    saveToLocalStorage();
}

function sortItemsAlphabetically() {
    if (!selectedGroup) return;
    
    const groupItems = m3uData.filter(item => item.groupTitle === selectedGroup);
    groupItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    
    m3uData = m3uData.filter(item => item.groupTitle !== selectedGroup);
    
    
    m3uData = [...m3uData, ...groupItems];
    
    renderItems();
    saveToLocalStorage();
}

function updateGroupsOrder(evt) {
    if (!evt) return;
    
    let allGroups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    let filteredGroups = allGroups;
    if (groupsFilterValue) {
        filteredGroups = allGroups.filter(g => g.toLowerCase().includes(groupsFilterValue));
    }
    
    
    const draggedGroup = filteredGroups[evt.oldIndex];
    
    if (selectedItems.size <= 1) {
        
        const dropGroup = filteredGroups[evt.newIndex];
        const from = allGroups.indexOf(draggedGroup);
        let to = allGroups.indexOf(dropGroup);
        if (to === -1) to = allGroups.length - 1;
        
        allGroups.splice(from, 1);
        allGroups.splice(to, 0, draggedGroup);
    } else {
        
        const selectedGroupNames = Array.from(selectedItems);
        const selectedIndices = filteredGroups.map((g, i) => selectedGroupNames.includes(g) ? i : -1).filter(i => i !== -1);
        
        
        let remainingGroups = filteredGroups.filter(g => !selectedGroupNames.includes(g));
        
        
        let insertAt = evt.newIndex;
        if (insertAt > Math.min(...selectedIndices)) {
            
            insertAt = insertAt - selectedIndices.filter(i => i < insertAt).length + 1;
        }
        
        
        filteredGroups = [
            ...remainingGroups.slice(0, insertAt),
            ...selectedGroupNames,
            ...remainingGroups.slice(insertAt)
        ];
        
        
        allGroups = filteredGroups;
    }
    
    
    const newData = [];
    allGroups.forEach(groupName => {
        const groupItems = m3uData.filter(item => item.groupTitle === groupName);
        newData.push(...groupItems);
    });
    
    m3uData = newData;
    
    
    if (selectedItems.size > 1) {
        selectedGroup = Array.from(selectedItems)[0];
    } else {
        selectedGroup = draggedGroup;
    }
    
    saveToLocalStorage();
    renderGroups();
}



function generateM3U() {
    let result = '#EXTM3U\n';
    
    m3uData.forEach(item => {
        let extinf = '#EXTINF:-1';
        if (item.tvgId) extinf += ` tvg-id="${item.tvgId}"`;
        if (item.tvgName) extinf += ` tvg-name="${item.tvgName}"`;
        if (item.tvgLogo) extinf += ` tvg-logo="${item.tvgLogo}"`;
        if (item.groupTitle) extinf += ` group-title="${item.groupTitle}"`;
        extinf += `,${item.name}`;
        
        result += extinf + '\n' + item.url + '\n';
    });
    
    return result;
}

function downloadM3U() {
    const content = generateM3U();
    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.m3u';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function saveToLocalStorage() {
    localStorage.setItem('m3uData', JSON.stringify(m3uData));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('m3uData');
    if (savedData) {
        m3uData = JSON.parse(savedData);
        if (m3uData.length > 0) {
            renderGroups();
            downloadBtn.disabled = false;
        }
    }
}

loadFromLocalStorage();

function updateItemGroupTitleDropdown(selectedValue) {
    const groups = [...new Set(m3uData.map(item => item.groupTitle || 'No Group'))];
    itemGroupTitleDropdownMenu.innerHTML = '';
    groups.forEach(group => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item';
        a.href = '#';
        a.textContent = group;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            itemGroupTitleSelected.textContent = group;
            itemGroupTitleInput.value = group;
        });
        li.appendChild(a);
        itemGroupTitleDropdownMenu.appendChild(li);
    });
    
    if (selectedValue) {
        itemGroupTitleSelected.textContent = selectedValue;
        itemGroupTitleInput.value = selectedValue;
    } else if (groups.length > 0) {
        itemGroupTitleSelected.textContent = groups[0];
        itemGroupTitleInput.value = groups[0];
    } else {
        itemGroupTitleSelected.textContent = 'No Group';
        itemGroupTitleInput.value = 'No Group';
    }
}

function saveGroupRename(oldName, newName) {
    if (!newName.trim() || oldName === newName) {
        renamingGroup = null;
        renderGroups();
        return;
    }
    m3uData.forEach(item => {
        if (item.groupTitle === oldName) item.groupTitle = newName;
    });
    renamingGroup = null;
    if (selectedGroup === oldName) selectedGroup = newName;
    saveToLocalStorage();
    renderGroups();
}

function saveItemRename(index, newName) {
    if (!newName.trim()) {
        renamingItemIndex = null;
        renderItems();
        return;
    }
    selectedGroupItems[index].name = newName;
    const globalIndex = m3uData.findIndex(i => i === selectedGroupItems[index]);
    if (globalIndex !== -1) {
        m3uData[globalIndex].name = newName;
    }
    renamingItemIndex = null;
    saveToLocalStorage();
    renderItems();
}

const itemUrlPreview = document.getElementById('itemUrlPreview');

function updateItemUrlPreview(url) {
    if (!url) {
        itemUrlPreview.href = '#';
        itemUrlPreview.classList.add('disabled');
        itemUrlPreview.setAttribute('tabindex', '-1');
    } else {
        itemUrlPreview.href = url;
        itemUrlPreview.classList.remove('disabled');
        itemUrlPreview.removeAttribute('tabindex');
    }
}
itemUrlInput.addEventListener('input', (e) => {
    updateItemUrlPreview(e.target.value);
});
itemUrlPreview.addEventListener('click', (e) => {
    if (!itemUrlInput.value) e.preventDefault();
});
