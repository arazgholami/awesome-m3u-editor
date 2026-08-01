let m3uData = [];
let groupOrder = [];
let playlistHeader = '#EXTM3U';
let selectedGroup = null;
let selectedGroups = new Set();
let selectedGroupItems = [];
let selectedChannels = new Set();
let activeChannelId = null;
let renamingGroup = null;
let renamingItemId = null;
let groupSelectionAnchor = null;
let itemSelectionAnchorId = null;
let nextItemId = 1;
let isCheckingChannels = false;
let checkingProgressText = '';

const STATUS_UNKNOWN = 'Unknown';
const STORAGE_KEY = 'awesomeM3uEditorProject';
const LEGACY_DATA_KEY = 'm3uData';
const LEGACY_HEADER_KEY = 'm3uHeader';
const NO_GROUP = 'No Group';
const LARGE_FILE_BYTES = 100 * 1024 * 1024;


function getStorageItem(key) {
    try {
        return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (error) {
        return null;
    }
}

function setStorageItem(key, value) {
    try {
        if (window.localStorage) window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn('Could not save to local storage:', error);
    }
}

function removeStorageItem(key) {
    try {
        if (window.localStorage) window.localStorage.removeItem(key);
    } catch (error) {
        console.warn('Could not remove local storage item:', error);
    }
}

const knownAttributeKeys = new Set([
    'tvg-id',
    'tvg-name',
    'tvg-logo',
    'group-title',
    'catchup',
    'catchup-type',
    'catchup-days'
]);

const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const playlistHeaderInput = document.getElementById('playlistHeaderInput');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');
const loadingCount = document.getElementById('loadingCount');
const loadingDetail = document.getElementById('loadingDetail');
const loadingTrack = document.getElementById('loadingTrack');
const loadingFills = Array.from(document.querySelectorAll('.loading-segment-fill'));
const appContainer = document.querySelector('.container-fluid');

const groupsList = document.getElementById('groupsList');
const groupsFilterInput = document.getElementById('groupsFilterInput');
const newGroupBtn = document.getElementById('newGroupBtn');
const renameGroupBtn = document.getElementById('renameGroupBtn');
const sortGroupsBtn = document.getElementById('sortGroupsBtn');
const deleteGroupsBtn = document.getElementById('deleteGroupsBtn');
const groupSelectedCount = document.getElementById('groupSelectedCount');

const itemsList = document.getElementById('itemsList');
const itemsFilterInput = document.getElementById('itemsFilterInput');
const newItemBtn = document.getElementById('newItemBtn');
const renameItemBtn = document.getElementById('renameItemBtn');
const cloneItemBtn = document.getElementById('cloneItemBtn');
const sortItemsBtn = document.getElementById('sortItemsBtn');
const sortItemsAzBtn = document.getElementById('sortItemsAzBtn');
const sortItemsStatusBtn = document.getElementById('sortItemsStatusBtn');
const checkItemsBtn = document.getElementById('checkItemsBtn');
const moveItemsBtn = document.getElementById('moveItemsBtn');
const groupDropdown = document.getElementById('groupDropdown');
const deleteItemsBtn = document.getElementById('deleteItemsBtn');
const itemSelectedCount = document.getElementById('itemSelectedCount');
const statusCheckProgress = document.getElementById('statusCheckProgress');

const itemDetailsForm = document.getElementById('itemDetailsForm');
const itemIndexInput = document.getElementById('itemIndex');
const itemNameInput = document.getElementById('itemName');
const itemUrlInput = document.getElementById('itemUrl');
const itemTvgIdInput = document.getElementById('itemTvgId');
const itemTvgNameInput = document.getElementById('itemTvgName');
const itemTvgLogoInput = document.getElementById('itemTvgLogo');
const itemCatchupInput = document.getElementById('itemCatchup');
const itemCatchupTypeInput = document.getElementById('itemCatchupType');
const itemCatchupDaysInput = document.getElementById('itemCatchupDays');
const itemAdditionalAttrsInput = document.getElementById('itemAdditionalAttrs');
const itemStatusInput = document.getElementById('itemStatus');
const itemStatusDescription = document.getElementById('itemStatusDescription');
const checkCurrentItemBtn = document.getElementById('checkCurrentItemBtn');
const itemUrlPreview = document.getElementById('itemUrlPreview');

const itemGroupTitleDropdownMenu = document.getElementById('itemGroupTitleDropdownMenu');
const itemGroupTitleSelected = document.getElementById('itemGroupTitleSelected');
const itemGroupTitleInput = document.getElementById('itemGroupTitle');

let groupsFilterValue = '';
let itemsFilterValue = '';

function makeItemId() {
    return `item_${Date.now()}_${nextItemId++}`;
}

function cleanGroupName(groupName) {
    const value = String(groupName || '').trim();
    return value || NO_GROUP;
}

function getItemGroup(item) {
    return cleanGroupName(item.groupTitle);
}

function ensureItem(item) {
    if (!item._id) item._id = makeItemId();
    item.name = item.name || 'Unnamed';
    item.url = item.url || '';
    item.tvgId = item.tvgId || '';
    item.tvgName = item.tvgName || '';
    item.tvgLogo = item.tvgLogo || '';
    item.groupTitle = cleanGroupName(item.groupTitle);
    item.duration = item.duration || '-1';
    item.catchup = item.catchup || '';
    item.catchupType = item.catchupType || '';
    item.catchupDays = item.catchupDays || '';
    item.additionalAttributes = item.additionalAttributes || '';
    item.status = normalizeChannelStatus(item.status || STATUS_UNKNOWN);
    item.statusDetail = item.statusDetail || '';
    item.lastChecked = item.lastChecked || '';
    item.extraLines = Array.isArray(item.extraLines) ? item.extraLines : [];
    return item;
}

function uniqueList(values) {
    const seen = new Set();
    const output = [];
    values.forEach(value => {
        const normalized = cleanGroupName(value);
        if (!seen.has(normalized)) {
            seen.add(normalized);
            output.push(normalized);
        }
    });
    return output;
}

function syncGroupOrder() {
    m3uData.forEach(ensureItem);
    const groupsFromItems = uniqueList(m3uData.map(getItemGroup));
    groupOrder = uniqueList([...groupOrder, ...groupsFromItems]);
    if (selectedGroup && !groupOrder.includes(selectedGroup)) selectedGroup = null;
    selectedGroups = new Set([...selectedGroups].filter(group => groupOrder.includes(group)));
}

function getAllGroups() {
    syncGroupOrder();
    return groupOrder.slice();
}

function getVisibleGroups() {
    const groups = getAllGroups();
    if (!groupsFilterValue) return groups;
    return groups.filter(group => group.toLowerCase().includes(groupsFilterValue));
}

function getGroupCount(groupName) {
    return m3uData.filter(item => getItemGroup(item) === groupName).length;
}

function ensureGroupExists(groupName) {
    const group = cleanGroupName(groupName);
    if (!groupOrder.includes(group)) groupOrder.push(group);
    return group;
}

function getGroupItems(groupName) {
    const group = cleanGroupName(groupName);
    return m3uData.filter(item => getItemGroup(item) === group);
}

function getVisibleItemsForSelectedGroup() {
    if (!selectedGroup) return [];
    const items = getGroupItems(selectedGroup);
    if (!itemsFilterValue) return items;
    return items.filter(item => {
        const haystack = [item.name, item.url, item.tvgId, item.tvgName, item.tvgLogo].join(' ').toLowerCase();
        return haystack.includes(itemsFilterValue);
    });
}

function rebuildDataByGroupOrder() {
    syncGroupOrder();
    const grouped = new Map();
    m3uData.forEach(item => {
        const group = getItemGroup(item);
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(item);
    });

    const newData = [];
    groupOrder.forEach(group => {
        if (grouped.has(group)) newData.push(...grouped.get(group));
    });

    grouped.forEach((items, group) => {
        if (!groupOrder.includes(group)) {
            groupOrder.push(group);
            newData.push(...items);
        }
    });

    m3uData = newData;
}

function replaceGroupItems(groupName, newGroupItems) {
    const group = cleanGroupName(groupName);
    let inserted = false;
    const newData = [];

    m3uData.forEach(item => {
        if (getItemGroup(item) === group) {
            if (!inserted) {
                newData.push(...newGroupItems);
                inserted = true;
            }
            return;
        }
        newData.push(item);
    });

    if (!inserted && newGroupItems.length > 0) {
        const insertAt = findInsertIndexForGroup(group);
        newData.splice(insertAt, 0, ...newGroupItems);
    }

    m3uData = newData;
    ensureGroupExists(group);
}

function findInsertIndexForGroup(groupName) {
    const group = cleanGroupName(groupName);
    const allGroups = getAllGroups();
    const groupIndex = allGroups.indexOf(group);

    for (let i = 0; i < m3uData.length; i++) {
        const currentGroup = getItemGroup(m3uData[i]);
        const currentIndex = allGroups.indexOf(currentGroup);
        if (currentIndex > groupIndex) return i;
    }

    return m3uData.length;
}

function moveSelectedBlock(order, movingItems, newIndex) {
    const movingSet = new Set(movingItems);
    const orderedMoving = order.filter(item => movingSet.has(item));
    if (orderedMoving.length === 0) return order.slice();

    const selectedIndices = orderedMoving.map(item => order.indexOf(item)).sort((a, b) => a - b);
    const minIndex = selectedIndices[0];
    const maxIndex = selectedIndices[selectedIndices.length - 1];

    if (newIndex >= minIndex && newIndex <= maxIndex) return order.slice();

    const remaining = order.filter(item => !movingSet.has(item));
    let insertAt = newIndex;

    if (newIndex > minIndex) {
        insertAt = newIndex - selectedIndices.filter(index => index < newIndex).length + 1;
    }

    insertAt = Math.max(0, Math.min(insertAt, remaining.length));
    return [
        ...remaining.slice(0, insertAt),
        ...orderedMoving,
        ...remaining.slice(insertAt)
    ];
}

function mergeVisibleOrder(fullOrder, originalVisibleOrder, newVisibleOrder) {
    const visibleSet = new Set(originalVisibleOrder);
    let visibleIndex = 0;

    return fullOrder.map(item => {
        if (!visibleSet.has(item)) return item;
        return newVisibleOrder[visibleIndex++];
    });
}

function parseAttributeString(text) {
    const attributes = {};
    const order = [];
    const source = String(text || '');
    const regex = /([A-Za-z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|“([^”]*)”|([^\s"'“”]+))/g;
    let match;

    while ((match = regex.exec(source)) !== null) {
        const key = match[1];
        const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
        if (!Object.prototype.hasOwnProperty.call(attributes, key)) order.push(key);
        attributes[key] = value;
    }

    return { attributes, order };
}

function formatAttribute(key, value) {
    return `${key}="${String(value).replace(/"/g, '&quot;')}"`;
}

function formatAdditionalAttributes(attributes, order) {
    return order
        .filter(key => !knownAttributeKeys.has(key))
        .map(key => formatAttribute(key, attributes[key]))
        .join(' ');
}

function buildAdditionalAttributes(item) {
    const parsed = parseAttributeString(item.additionalAttributes || '');
    return parsed.order
        .filter(key => !knownAttributeKeys.has(key))
        .map(key => formatAttribute(key, parsed.attributes[key]))
        .join(' ');
}

function buildExtinfLine(item) {
    const attributes = [];
    if (item.tvgId) attributes.push(formatAttribute('tvg-id', item.tvgId));
    if (item.tvgName) attributes.push(formatAttribute('tvg-name', item.tvgName));
    if (item.tvgLogo) attributes.push(formatAttribute('tvg-logo', item.tvgLogo));
    if (item.groupTitle) attributes.push(formatAttribute('group-title', item.groupTitle));
    if (item.catchup) attributes.push(formatAttribute('catchup', item.catchup));
    if (item.catchupType) attributes.push(formatAttribute('catchup-type', item.catchupType));
    if (item.catchupDays !== '') attributes.push(formatAttribute('catchup-days', item.catchupDays));

    const additional = buildAdditionalAttributes(item);
    if (additional) attributes.push(additional);

    const attrsText = attributes.length ? ` ${attributes.join(' ')}` : '';
    return `#EXTINF:${item.duration || '-1'}${attrsText},${item.name || ''}`;
}

function normalizeChannelStatus(status) {
    const value = String(status || '').trim();
    return value || STATUS_UNKNOWN;
}

function getStatusDescription(status) {
    const value = normalizeChannelStatus(status);
    const code = Number(value);

    if (value === STATUS_UNKNOWN) return 'Unknown. This channel has not been checked yet.';
    if (value === 'Queued') return 'Queued. This channel is waiting to be checked.';
    if (value === 'Checking') return 'Checking now.';
    if (value === 'No URL') return 'No URL is set for this channel.';
    if (value === 'Bad URL') return 'The URL is not valid.';
    if (value === 'Unsupported') return 'Only http and https URLs can be checked from the browser.';
    if (value === 'CORS') return 'The browser reached it, but the server did not allow reading the real HTTP status.';
    if (value === 'Blocked') return 'The browser could not complete the request. It may be mixed content, DNS, network, ad blocker, or CORS.';

    if (code >= 200 && code < 300) return `${value} means fine and reachable.`;
    if (code >= 300 && code < 400) return `${value} means redirected. The final URL may still work in a player.`;
    if (code === 401) return '401 means authentication is required.';
    if (code === 403) return '403 means it is not accessible by you. It may be token, account, or geo-limited.';
    if (code === 404) return '404 means not found.';
    if (code === 408) return '408 means the server timed out.';
    if (code === 410) return '410 means gone.';
    if (code === 429) return '429 means rate-limited.';
    if (code === 451) return '451 means unavailable for legal or regional reasons.';
    if (code >= 400 && code < 500) return `${value} is a client/access error.`;
    if (code >= 500 && code < 600) return `${value} is a provider/server error.`;
    return value;
}

function getStatusClass(status) {
    const value = normalizeChannelStatus(status);
    const code = Number(value);

    if (value === 'Checking') return 'status-checking';
    if (value === 'Queued' || value === STATUS_UNKNOWN || value === 'CORS') return 'status-neutral';
    if (value === 'Blocked' || value === 'No URL' || value === 'Bad URL' || value === 'Unsupported') return 'status-bad';
    if (code >= 200 && code < 300) return 'status-ok';
    if (code >= 300 && code < 400) return 'status-warning';
    if (code === 401 || code === 403 || code === 408 || code === 429 || code === 451) return 'status-warning';
    if (code >= 400) return 'status-bad';
    return 'status-neutral';
}

function getStatusLabel(item) {
    return normalizeChannelStatus(item && item.status);
}

function getStatusTitle(item) {
    const detail = item && item.statusDetail ? String(item.statusDetail) : getStatusDescription(item && item.status);
    const checked = item && item.lastChecked ? ` Last checked: ${item.lastChecked}` : '';
    return `${detail}${checked}`.trim();
}

function markChannelStatus(item, status, detail) {
    if (!item) return;
    item.status = normalizeChannelStatus(status);
    item.statusDetail = detail || getStatusDescription(item.status);
    item.lastChecked = new Date().toLocaleString();
}

function setProgress(text) {
    checkingProgressText = text || '';
    if (statusCheckProgress) statusCheckProgress.textContent = checkingProgressText;
}

function updateItemStatusControls(item) {
    const status = getStatusLabel(item);
    const description = getStatusTitle(item);

    if (itemStatusInput) {
        itemStatusInput.value = status;
        itemStatusInput.className = `form-control form-control-sm ${getStatusClass(status)}`;
        itemStatusInput.title = description;
    }

    if (itemStatusDescription) itemStatusDescription.textContent = description;
}

function getSelectedChannelItems() {
    const visibleSelected = selectedGroupItems.filter(item => selectedChannels.has(item._id));
    const visibleIds = new Set(visibleSelected.map(item => item._id));
    const hiddenSelected = m3uData.filter(item => selectedChannels.has(item._id) && !visibleIds.has(item._id));
    return [...visibleSelected, ...hiddenSelected];
}

function resetItemForm() {
    itemDetailsForm.reset();
    itemIndexInput.value = '';
    itemGroupTitleSelected.textContent = selectedGroup || 'Select group';
    itemGroupTitleInput.value = selectedGroup || '';
    updateItemStatusControls(null);
    if (checkCurrentItemBtn) checkCurrentItemBtn.disabled = true;
    updateItemUrlPreview('');
}

function fillItemForm(item) {
    if (!item) {
        resetItemForm();
        return;
    }

    itemIndexInput.value = item._id;
    itemNameInput.value = item.name || '';
    itemUrlInput.value = item.url || '';
    itemTvgIdInput.value = item.tvgId || '';
    itemTvgNameInput.value = item.tvgName || '';
    itemTvgLogoInput.value = item.tvgLogo || '';
    itemCatchupInput.value = item.catchup || '';
    itemCatchupTypeInput.value = item.catchupType || '';
    itemCatchupDaysInput.value = item.catchupDays || '';
    itemAdditionalAttrsInput.value = item.additionalAttributes || '';
    updateItemStatusControls(item);
    if (checkCurrentItemBtn) checkCurrentItemBtn.disabled = isCheckingChannels || !item._id;
    updateItemGroupTitleDropdown(item.groupTitle || selectedGroup || NO_GROUP);
    updateItemUrlPreview(item.url || '');
}

function updateItemUrlPreview(url) {
    if (!url) {
        itemUrlPreview.href = '#';
        itemUrlPreview.classList.add('disabled');
        itemUrlPreview.setAttribute('tabindex', '-1');
        return;
    }

    itemUrlPreview.href = url;
    itemUrlPreview.classList.remove('disabled');
    itemUrlPreview.removeAttribute('tabindex');
}

function updateGroupDropdown() {
    const groups = getAllGroups();
    groupDropdown.innerHTML = '';

    groups.forEach(group => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dropdown-item';
        link.href = '#';
        link.textContent = group;
        link.addEventListener('click', event => {
            event.preventDefault();
            moveSelectedItemsToGroup(group);
        });
        li.appendChild(link);
        groupDropdown.appendChild(li);
    });
}

function updateItemGroupTitleDropdown(selectedValue) {
    const groups = getAllGroups();
    itemGroupTitleDropdownMenu.innerHTML = '';

    groups.forEach(group => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dropdown-item';
        link.href = '#';
        link.textContent = group;
        link.addEventListener('click', event => {
            event.preventDefault();
            itemGroupTitleSelected.textContent = group;
            itemGroupTitleInput.value = group;
        });
        li.appendChild(link);
        itemGroupTitleDropdownMenu.appendChild(li);
    });

    const value = cleanGroupName(selectedValue || selectedGroup || groups[0] || NO_GROUP);
    itemGroupTitleSelected.textContent = value;
    itemGroupTitleInput.value = value;
}

function updateActionState() {
    syncGroupOrder();
    const groupCount = getAllGroups().length;
    const visibleGroupCount = getVisibleGroups().length;
    const itemCount = selectedGroup ? getGroupItems(selectedGroup).length : 0;
    const selectedGroupCount = selectedGroups.size;
    const selectedItemCount = selectedChannels.size;

    renameGroupBtn.disabled = selectedGroupCount !== 1;
    deleteGroupsBtn.disabled = selectedGroupCount === 0;
    sortGroupsBtn.disabled = visibleGroupCount < 2;

    newItemBtn.disabled = !selectedGroup;
    renameItemBtn.disabled = selectedItemCount !== 1;
    cloneItemBtn.disabled = selectedItemCount !== 1;
    sortItemsBtn.disabled = !selectedGroup || itemCount < 2;
    checkItemsBtn.disabled = isCheckingChannels || selectedItemCount === 0;
    checkItemsBtn.textContent = isCheckingChannels ? 'Checking...' : 'Check';
    if (checkCurrentItemBtn) checkCurrentItemBtn.disabled = isCheckingChannels || !activeChannelId;
    moveItemsBtn.disabled = selectedItemCount === 0 || groupCount === 0;
    deleteItemsBtn.disabled = selectedItemCount === 0;
    downloadBtn.disabled = m3uData.length === 0 && getAllGroups().length === 0;

    groupSelectedCount.textContent = selectedGroupCount ? `(${selectedGroupCount} selected)` : '';
    itemSelectedCount.textContent = selectedItemCount ? `(${selectedItemCount} selected)` : '';
    if (statusCheckProgress) statusCheckProgress.textContent = checkingProgressText;
}

function renderGroups() {
    syncGroupOrder();
    const groups = getVisibleGroups();
    groupsList.innerHTML = '';
    updateGroupDropdown();
    updateItemGroupTitleDropdown(itemGroupTitleInput.value || selectedGroup || '');

    groups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
        groupItem.dataset.groupName = group;

        if (selectedGroups.has(group)) groupItem.classList.add('selected');
        if (selectedGroup === group) groupItem.classList.add('active');

        if (renamingGroup === group) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = group;
            input.className = 'form-control form-control-sm';
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') saveGroupRename(group, input.value);
                if (event.key === 'Escape') {
                    renamingGroup = null;
                    renderGroups();
                }
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-sm btn-success';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', () => saveGroupRename(group, input.value));

            groupItem.appendChild(input);
            groupItem.appendChild(saveBtn);
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'list-name';
            nameSpan.textContent = group;

            const countSpan = document.createElement('span');
            countSpan.className = 'badge bg-secondary ms-auto';
            countSpan.textContent = getGroupCount(group);

            groupItem.appendChild(nameSpan);
            groupItem.appendChild(countSpan);
            groupItem.addEventListener('click', event => selectGroup(event, group));
            groupItem.addEventListener('dblclick', () => startGroupRename(group));
        }

        groupsList.appendChild(groupItem);
    });

    if (!selectedGroup && getAllGroups().length > 0) {
        const firstGroup = groups[0] || getAllGroups()[0];
        selectedGroup = firstGroup;
        selectedGroups = new Set([firstGroup]);
        groupSelectionAnchor = firstGroup;
        renderGroups();
        renderItems();
        return;
    }

    updateActionState();
}

function renderItems() {
    selectedGroupItems = getVisibleItemsForSelectedGroup();
    selectedChannels = new Set([...selectedChannels].filter(id => m3uData.some(item => item._id === id)));

    if (activeChannelId && !m3uData.some(item => item._id === activeChannelId)) {
        activeChannelId = null;
    }

    itemsList.innerHTML = '';

    if (!selectedGroup) {
        resetItemForm();
        updateActionState();
        return;
    }

    selectedGroupItems.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
        itemElement.dataset.itemId = item._id;

        if (selectedChannels.has(item._id)) itemElement.classList.add('selected');
        if (activeChannelId === item._id) itemElement.classList.add('active');

        if (renamingItemId === item._id) {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = item.name || 'Unnamed';
            input.className = 'form-control form-control-sm';
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') saveItemRename(item._id, input.value);
                if (event.key === 'Escape') {
                    renamingItemId = null;
                    renderItems();
                }
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-sm btn-success';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', () => saveItemRename(item._id, input.value));

            itemElement.appendChild(input);
            itemElement.appendChild(saveBtn);
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
        } else {
            const channelMain = document.createElement('span');
            channelMain.className = 'channel-main d-flex align-items-center gap-2';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'list-name';
            nameSpan.textContent = item.name || 'Unnamed';

            const statusSpan = document.createElement('span');
            statusSpan.className = `status-badge ${getStatusClass(item.status)}`;
            statusSpan.textContent = getStatusLabel(item);
            statusSpan.title = getStatusTitle(item);

            const urlSpan = document.createElement('span');
            urlSpan.className = 'item-meta text-muted ms-auto';
            urlSpan.textContent = item.url || '';
            urlSpan.title = item.url || '';

            channelMain.appendChild(nameSpan);
            channelMain.appendChild(statusSpan);
            itemElement.appendChild(channelMain);
            itemElement.appendChild(urlSpan);
            itemElement.addEventListener('click', event => selectItem(event, item._id));
            itemElement.addEventListener('dblclick', () => startItemRename(item._id));
        }

        itemsList.appendChild(itemElement);
    });

    if (activeChannelId) {
        fillItemForm(m3uData.find(item => item._id === activeChannelId));
    } else {
        resetItemForm();
    }

    updateActionState();
}

function selectGroup(event, groupName) {
    const group = cleanGroupName(groupName);
    const visibleGroups = getVisibleGroups();
    const useToggle = event && (event.ctrlKey || event.metaKey);
    const useRange = event && event.shiftKey;

    renamingGroup = null;
    renamingItemId = null;

    if (useToggle) {
        if (selectedGroups.has(group)) {
            selectedGroups.delete(group);
        } else {
            selectedGroups.add(group);
            selectedGroup = group;
        }
        if (!selectedGroups.size) selectedGroup = null;
        if (selectedGroup && !selectedGroups.has(selectedGroup)) selectedGroup = [...selectedGroups][0] || null;
        groupSelectionAnchor = group;
        selectedChannels.clear();
        activeChannelId = null;
        renderGroups();
        renderItems();
        return;
    }

    if (useRange) {
        const anchor = groupSelectionAnchor || selectedGroup || group;
        let start = visibleGroups.indexOf(anchor);
        let end = visibleGroups.indexOf(group);
        if (start === -1) start = 0;
        if (end === -1) end = start;
        if (start > end) [start, end] = [end, start];
        selectedGroups = new Set(visibleGroups.slice(start, end + 1));
        selectedGroup = group;
        selectedChannels.clear();
        activeChannelId = null;
        renderGroups();
        renderItems();
        return;
    }

    selectedGroup = group;
    selectedGroups = new Set([group]);
    groupSelectionAnchor = group;
    selectedChannels.clear();
    activeChannelId = null;
    renderGroups();
    renderItems();
}

function selectItem(event, itemId) {
    const item = m3uData.find(entry => entry._id === itemId);
    if (!item) return;

    const useToggle = event && (event.ctrlKey || event.metaKey);
    const useRange = event && event.shiftKey;

    renamingItemId = null;

    if (useToggle) {
        if (selectedChannels.has(itemId)) {
            selectedChannels.delete(itemId);
            if (activeChannelId === itemId) activeChannelId = [...selectedChannels][0] || null;
        } else {
            selectedChannels.add(itemId);
            activeChannelId = itemId;
        }
        itemSelectionAnchorId = itemId;
        renderItems();
        return;
    }

    if (useRange) {
        const visibleIds = selectedGroupItems.map(entry => entry._id);
        const anchor = itemSelectionAnchorId || activeChannelId || itemId;
        let start = visibleIds.indexOf(anchor);
        let end = visibleIds.indexOf(itemId);
        if (start === -1) start = 0;
        if (end === -1) end = start;
        if (start > end) [start, end] = [end, start];
        selectedChannels = new Set(visibleIds.slice(start, end + 1));
        activeChannelId = itemId;
        renderItems();
        return;
    }

    selectedChannels = new Set([itemId]);
    activeChannelId = itemId;
    itemSelectionAnchorId = itemId;
    renderItems();
}

function startGroupRename(groupName) {
    const group = cleanGroupName(groupName);
    if (!groupOrder.includes(group)) return;
    selectedGroup = group;
    selectedGroups = new Set([group]);
    groupSelectionAnchor = group;
    renamingGroup = group;
    renderGroups();
}

function startSelectedGroupRename() {
    if (selectedGroups.size !== 1) return;
    startGroupRename([...selectedGroups][0]);
}

function startItemRename(itemId) {
    const item = m3uData.find(entry => entry._id === itemId);
    if (!item) return;
    selectedChannels = new Set([itemId]);
    activeChannelId = itemId;
    itemSelectionAnchorId = itemId;
    renamingItemId = itemId;
    renderItems();
}

function startSelectedItemRename() {
    if (selectedChannels.size !== 1) return;
    startItemRename([...selectedChannels][0]);
}

function saveGroupRename(oldName, newName) {
    const oldGroup = cleanGroupName(oldName);
    const newGroup = cleanGroupName(newName);

    if (!newGroup || oldGroup === newGroup) {
        renamingGroup = null;
        renderGroups();
        return;
    }

    if (groupOrder.includes(newGroup) && oldGroup !== newGroup) {
        const shouldMerge = confirm(`A group named "${newGroup}" already exists. Merge "${oldGroup}" into it?`);
        if (!shouldMerge) return;
        groupOrder = groupOrder.filter(group => group !== oldGroup);
    } else {
        groupOrder = groupOrder.map(group => group === oldGroup ? newGroup : group);
    }

    m3uData.forEach(item => {
        if (getItemGroup(item) === oldGroup) item.groupTitle = newGroup;
    });

    selectedGroup = newGroup;
    selectedGroups = new Set([newGroup]);
    groupSelectionAnchor = newGroup;
    renamingGroup = null;
    rebuildDataByGroupOrder();
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function saveItemRename(itemId, newName) {
    const item = m3uData.find(entry => entry._id === itemId);
    if (!item) return;

    const name = String(newName || '').trim();
    if (!name) {
        renamingItemId = null;
        renderItems();
        return;
    }

    item.name = name;
    renamingItemId = null;
    activeChannelId = itemId;
    selectedChannels = new Set([itemId]);
    saveToLocalStorage();
    renderItems();
}

function createNewGroup() {
    const groups = getAllGroups();
    let newGroupName = 'New Group';
    let suffix = 1;

    while (groups.includes(newGroupName)) {
        newGroupName = `New Group ${suffix++}`;
    }

    groupOrder.unshift(newGroupName);
    selectedGroup = newGroupName;
    selectedGroups = new Set([newGroupName]);
    groupSelectionAnchor = newGroupName;
    selectedChannels.clear();
    activeChannelId = null;
    renamingGroup = newGroupName;
    rebuildDataByGroupOrder();
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function createNewItem() {
    if (!selectedGroup) return;

    const group = ensureGroupExists(selectedGroup);
    const item = ensureItem({
        name: 'New Item',
        url: '',
        tvgId: '',
        tvgName: '',
        tvgLogo: '',
        groupTitle: group,
        duration: '-1',
        catchup: '',
        catchupType: '',
        catchupDays: '',
        additionalAttributes: '',
        status: STATUS_UNKNOWN,
        statusDetail: '',
        lastChecked: '',
        extraLines: []
    });

    const groupItems = getGroupItems(group);
    if (groupItems.length) {
        const firstIndex = m3uData.findIndex(entry => getItemGroup(entry) === group);
        m3uData.splice(firstIndex, 0, item);
    } else {
        const insertAt = findInsertIndexForGroup(group);
        m3uData.splice(insertAt, 0, item);
    }

    selectedChannels = new Set([item._id]);
    activeChannelId = item._id;
    itemSelectionAnchorId = item._id;
    saveToLocalStorage();
    renderGroups();
    renderItems();

    setTimeout(() => {
        itemNameInput.focus();
        itemNameInput.select();
    }, 0);
}

function cloneSelectedItem() {
    if (selectedChannels.size !== 1) return;

    const sourceId = [...selectedChannels][0];
    const sourceIndex = m3uData.findIndex(item => item._id === sourceId);
    if (sourceIndex === -1) return;

    const source = m3uData[sourceIndex];
    const clone = ensureItem({
        ...source,
        _id: makeItemId(),
        name: `${source.name || 'Unnamed'} Copy`,
        extraLines: Array.isArray(source.extraLines) ? source.extraLines.slice() : []
    });

    m3uData.splice(sourceIndex + 1, 0, clone);
    selectedGroup = getItemGroup(clone);
    selectedGroups = new Set([selectedGroup]);
    selectedChannels = new Set([clone._id]);
    activeChannelId = clone._id;
    itemSelectionAnchorId = clone._id;
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function deleteSelectedGroups() {
    if (!selectedGroups.size) return;

    const count = selectedGroups.size;
    if (!confirm(`Delete ${count} selected group${count === 1 ? '' : 's'}? This will also delete every channel inside.`)) {
        return;
    }

    const groupsToDelete = new Set(selectedGroups);
    m3uData = m3uData.filter(item => !groupsToDelete.has(getItemGroup(item)));
    groupOrder = groupOrder.filter(group => !groupsToDelete.has(group));
    selectedGroups.clear();
    selectedGroup = groupOrder[0] || null;
    if (selectedGroup) selectedGroups.add(selectedGroup);
    groupSelectionAnchor = selectedGroup;
    selectedChannels.clear();
    activeChannelId = null;
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function deleteSelectedItems() {
    if (!selectedChannels.size) return;

    const idsToDelete = new Set(selectedChannels);
    m3uData = m3uData.filter(item => !idsToDelete.has(item._id));
    selectedChannels.clear();
    activeChannelId = null;
    itemSelectionAnchorId = null;
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function moveSelectedItemsToGroup(targetGroupName) {
    if (!selectedChannels.size) return;

    const targetGroup = ensureGroupExists(targetGroupName);
    const movedIds = new Set(selectedChannels);

    m3uData.forEach(item => {
        if (movedIds.has(item._id)) item.groupTitle = targetGroup;
    });

    selectedGroup = targetGroup;
    selectedGroups = new Set([targetGroup]);
    groupSelectionAnchor = targetGroup;
    selectedChannels = movedIds;
    activeChannelId = [...movedIds][0] || null;
    itemSelectionAnchorId = activeChannelId;
    rebuildDataByGroupOrder();
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function sortGroupsAlphabetically() {
    const visibleGroups = getVisibleGroups();
    const allGroups = getAllGroups();
    const sortedVisible = visibleGroups.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    groupOrder = mergeVisibleOrder(allGroups, visibleGroups, sortedVisible);
    rebuildDataByGroupOrder();
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function sortItemsAlphabetically() {
    if (!selectedGroup) return;

    const groupItems = getGroupItems(selectedGroup).slice().sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });

    replaceGroupItems(selectedGroup, groupItems);
    saveToLocalStorage();
    renderItems();
}

function getStatusSortWeight(status) {
    const value = normalizeChannelStatus(status);
    const code = Number(value);

    if (value === 'Checking') return 10;
    if (value === 'Queued') return 20;
    if (code >= 200 && code < 300) return 30;
    if (code >= 300 && code < 400) return 40;
    if (code === 401 || code === 403 || code === 408 || code === 429 || code === 451) return 50;
    if (code >= 400 && code < 500) return 60;
    if (code >= 500 && code < 600) return 70;
    if (value === 'CORS') return 80;
    if (value === 'No URL' || value === 'Bad URL' || value === 'Unsupported' || value === 'Blocked') return 90;
    if (value === STATUS_UNKNOWN) return 100;
    return 110;
}

function sortItemsByStatus() {
    if (!selectedGroup) return;

    const groupItems = getGroupItems(selectedGroup).slice().sort((a, b) => {
        const weightDiff = getStatusSortWeight(a.status) - getStatusSortWeight(b.status);
        if (weightDiff) return weightDiff;

        const statusDiff = getStatusLabel(a).localeCompare(getStatusLabel(b), undefined, { numeric: true, sensitivity: 'base' });
        if (statusDiff) return statusDiff;

        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });

    replaceGroupItems(selectedGroup, groupItems);
    saveToLocalStorage();
    renderItems();
}

function updateGroupsOrder(evt) {
    if (!evt) return;

    const visibleGroups = getVisibleGroups();
    const allGroups = getAllGroups();
    const draggedGroup = evt.item.dataset.groupName || visibleGroups[evt.oldIndex];
    const groupsToMove = selectedGroups.has(draggedGroup)
        ? visibleGroups.filter(group => selectedGroups.has(group))
        : [draggedGroup];

    const newVisibleOrder = moveSelectedBlock(visibleGroups, groupsToMove, evt.newIndex);
    groupOrder = mergeVisibleOrder(allGroups, visibleGroups, newVisibleOrder);
    selectedGroup = draggedGroup;
    selectedGroups = new Set(groupsToMove);
    groupSelectionAnchor = draggedGroup;
    selectedChannels.clear();
    activeChannelId = null;
    rebuildDataByGroupOrder();
    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function updateItemsOrder(evt) {
    if (!selectedGroup || !evt) return;

    const visibleItems = selectedGroupItems.slice();
    const draggedId = evt.item.dataset.itemId || (visibleItems[evt.oldIndex] && visibleItems[evt.oldIndex]._id);
    const selectedIds = selectedChannels.has(draggedId)
        ? visibleItems.filter(item => selectedChannels.has(item._id)).map(item => item._id)
        : [draggedId];

    const visibleIds = visibleItems.map(item => item._id);
    const newVisibleIds = moveSelectedBlock(visibleIds, selectedIds, evt.newIndex);
    const itemById = new Map(visibleItems.map(item => [item._id, item]));
    const newVisibleItems = newVisibleIds.map(id => itemById.get(id)).filter(Boolean);

    const fullGroupItems = getGroupItems(selectedGroup);
    const visibleSet = new Set(visibleIds);
    let cursor = 0;
    const newFullGroupItems = fullGroupItems.map(item => {
        if (!visibleSet.has(item._id)) return item;
        return newVisibleItems[cursor++] || item;
    });

    replaceGroupItems(selectedGroup, newFullGroupItems);
    selectedChannels = new Set(selectedIds);
    activeChannelId = draggedId;
    itemSelectionAnchorId = draggedId;
    saveToLocalStorage();
    renderItems();
}


function isHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => window.clearTimeout(timer));
}

async function readCorsStatus(url) {
    const headResponse = await fetchWithTimeout(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'follow'
    }, 12000);

    return headResponse;
}

async function readCorsStatusWithGet(url) {
    const getResponse = await fetchWithTimeout(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'follow'
    }, 12000);

    return getResponse;
}

async function canReachWithoutReadingStatus(url) {
    await fetchWithTimeout(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'follow'
    }, 12000);
}

async function checkSingleChannel(item) {
    const rawUrl = String(item.url || '').trim();

    if (!rawUrl) {
        markChannelStatus(item, 'No URL', getStatusDescription('No URL'));
        return;
    }

    if (!isValidUrl(rawUrl)) {
        markChannelStatus(item, 'Bad URL', getStatusDescription('Bad URL'));
        return;
    }

    if (!isHttpUrl(rawUrl)) {
        markChannelStatus(item, 'Unsupported', getStatusDescription('Unsupported'));
        return;
    }

    try {
        let response;
        try {
            response = await readCorsStatus(rawUrl);
        } catch (headError) {
            response = await readCorsStatusWithGet(rawUrl);
        }

        const status = String(response.status || STATUS_UNKNOWN);
        const statusText = response.statusText ? ` ${response.statusText}` : '';
        markChannelStatus(item, status, `${status}${statusText}. ${getStatusDescription(status)}`);
        return;
    } catch (corsOrNetworkError) {
        try {
            await canReachWithoutReadingStatus(rawUrl);
            markChannelStatus(item, 'CORS', getStatusDescription('CORS'));
        } catch (blockedError) {
            const detail = blockedError && blockedError.name === 'AbortError'
                ? 'The request timed out. The stream may be slow, endless, blocked, or unreachable.'
                : getStatusDescription('Blocked');
            markChannelStatus(item, 'Blocked', detail);
        }
    }
}

async function checkChannelItems(items, emptyMessage, finishedLabel) {
    if (isCheckingChannels) return;

    const targets = Array.from(new Set((items || []).filter(Boolean)));
    if (targets.length === 0) {
        setProgress(emptyMessage || 'Select at least one channel to check.');
        updateActionState();
        return;
    }

    isCheckingChannels = true;
    updateActionState();

    const candidates = targets.map(item => {
        ensureItem(item);
        item.status = 'Queued';
        item.statusDetail = getStatusDescription('Queued');
        item.lastChecked = '';
        return item;
    });

    const label = finishedLabel || 'selected channels';
    const total = candidates.length;
    const batchSize = 5;

    setProgress(`Queued ${total} ${label}. Checking 5 at a time.`);
    saveToLocalStorage();
    renderItems();

    for (let start = 0; start < total; start += batchSize) {
        const batch = candidates.slice(start, start + batchSize);
        const batchStart = start + 1;
        const batchEnd = start + batch.length;

        batch.forEach(item => {
            item.status = 'Checking';
            item.statusDetail = getStatusDescription('Checking');
            item.lastChecked = new Date().toLocaleString();
        });

        setProgress(`Checking ${batchStart}-${batchEnd} of ${total}. ${Math.max(total - batchEnd, 0)} queued.`);
        saveToLocalStorage();
        renderItems();

        await Promise.all(batch.map(item => checkSingleChannel(item)));

        setProgress(`Checked ${batchEnd} of ${total}. ${Math.max(total - batchEnd, 0)} queued.`);
        saveToLocalStorage();
        renderItems();
    }

    isCheckingChannels = false;
    setProgress(`Finished checking ${total} ${label}.`);
    saveToLocalStorage();
    renderItems();
    updateActionState();
}

async function checkChannels() {
    await checkChannelItems(getSelectedChannelItems(), 'Select at least one channel to check.', 'selected channels');
}

async function checkCurrentItem() {
    if (!activeChannelId || isCheckingChannels) return;

    saveCurrentItemFromForm();
    const item = m3uData.find(entry => entry._id === activeChannelId);
    if (!item) return;

    selectedChannels = new Set([item._id]);
    await checkChannelItems([item], 'Select a channel to check.', 'current channel');
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, power);
    return `${power === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[power]}`;
}

const LOAD_PHASES = ['Reading file', 'Finding channels', 'Building the list'];

function showLoading(detail) {
    if (!loadingOverlay) return;
    loadingDetail.textContent = detail || '';
    loadingOverlay.classList.remove('d-none');
    if (appContainer) appContainer.inert = true;
    setLoadingPhase(0, 0);
}

function setLoadingPhase(index, ratio, count) {
    if (!loadingOverlay) return;

    loadingMessage.textContent = LOAD_PHASES[index];
    loadingCount.textContent = count || '';

    loadingFills.forEach((fill, position) => {
        const filled = position < index ? 1 : position === index ? ratio : 0;
        fill.style.width = `${Math.round(filled * 100)}%`;
    });

    const overall = (index + ratio) / LOAD_PHASES.length;
    loadingTrack.setAttribute('aria-valuenow', String(Math.round(overall * 100)));
}

function hideLoading() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.add('d-none');
    if (appContainer) appContainer.inert = false;
    loadingFills.forEach(fill => { fill.style.width = '0%'; });
}

function nextPaint() {
    // Background tabs never fire requestAnimationFrame, so fall back to a timer
    // to keep the load from stalling when the user switches away mid-import.
    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
        requestAnimationFrame(() => requestAnimationFrame(finish));
        setTimeout(finish, 50);
    });
}

function readFileAsText(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
        reader.onprogress = event => {
            if (event.lengthComputable) onProgress(event.loaded / event.total);
        };
        reader.readAsText(file);
    });
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const sizeLabel = formatFileSize(file.size);

    if (file.size > LARGE_FILE_BYTES) {
        const proceed = confirm(`This playlist is ${sizeLabel}. Loading it will take a while, and the editor will run slower afterwards.\n\nLoad it anyway?`);
        if (!proceed) {
            fileInput.value = '';
            return;
        }
    }

    showLoading(`${file.name} · ${sizeLabel}`);
    await nextPaint();

    try {
        const content = await readFileAsText(file, ratio => {
            setLoadingPhase(0, ratio, `${Math.round(ratio * 100)}%`);
        });

        setLoadingPhase(1, 1);
        await nextPaint();
        parseM3U(content);

        setLoadingPhase(2, 1, `${m3uData.length.toLocaleString()} channels`);
        await nextPaint();
        saveToLocalStorage();
        renderGroups();
        renderItems();
    } catch (error) {
        console.error('Could not load the playlist file:', error);
        alert(`Could not read ${file.name}. Check that the file still exists, then choose it again.`);
    } finally {
        hideLoading();
    }
}

function parseM3U(content) {
    m3uData = [];
    groupOrder = [];
    playlistHeader = '#EXTM3U';
    selectedGroup = null;
    selectedGroups.clear();
    selectedChannels.clear();
    activeChannelId = null;
    renamingGroup = null;
    renamingItemId = null;

    const lines = String(content || '').replace(/\r/g, '').split('\n');
    let currentItem = null;

    lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;

        if (line.toUpperCase().startsWith('#EXTM3U')) {
            playlistHeader = line;
            playlistHeaderInput.value = playlistHeader;
            return;
        }

        if (line.toUpperCase().startsWith('#EXTINF')) {
            currentItem = parseExtinfLine(line);
            return;
        }

        if (currentItem) {
            if (line.startsWith('#')) {
                currentItem.extraLines.push(line);
                return;
            }

            currentItem.url = line;
            ensureItem(currentItem);
            m3uData.push(currentItem);
            ensureGroupExists(currentItem.groupTitle);
            currentItem = null;
        }
    });

    syncGroupOrder();
    selectedGroup = groupOrder[0] || null;
    if (selectedGroup) {
        selectedGroups = new Set([selectedGroup]);
        groupSelectionAnchor = selectedGroup;
    }
}

function parseExtinfLine(line) {
    const commaIndex = line.indexOf(',');
    const metaPart = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
    const name = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : 'Unnamed';
    const info = metaPart.replace(/^#EXTINF:/i, '').trim();
    const firstSpace = info.search(/\s/);
    const duration = firstSpace >= 0 ? info.slice(0, firstSpace) : (info || '-1');
    const attributeText = firstSpace >= 0 ? info.slice(firstSpace + 1) : '';
    const parsed = parseAttributeString(attributeText);
    const attrs = parsed.attributes;

    return {
        _id: makeItemId(),
        name: name || 'Unnamed',
        url: '',
        duration: duration || '-1',
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || '',
        tvgLogo: attrs['tvg-logo'] || '',
        groupTitle: cleanGroupName(attrs['group-title']),
        catchup: attrs.catchup || '',
        catchupType: attrs['catchup-type'] || '',
        catchupDays: attrs['catchup-days'] || '',
        additionalAttributes: formatAdditionalAttributes(attrs, parsed.order),
        status: STATUS_UNKNOWN,
        statusDetail: '',
        lastChecked: '',
        extraLines: []
    };
}

function generateM3U() {
    syncGroupOrder();
    const header = (playlistHeaderInput.value || '#EXTM3U').trim() || '#EXTM3U';
    playlistHeader = header.toUpperCase().startsWith('#EXTM3U') ? header : `#EXTM3U ${header}`;

    const lines = [playlistHeader];
    const orderedItems = [];
    groupOrder.forEach(group => {
        orderedItems.push(...getGroupItems(group));
    });

    orderedItems.forEach(item => {
        ensureItem(item);
        lines.push(buildExtinfLine(item));
        item.extraLines.forEach(extraLine => lines.push(extraLine));
        lines.push(item.url || '');
    });

    return `${lines.join('\n')}\n`;
}

function downloadM3U() {
    if (activeChannelId) {
        saveCurrentItemFromForm();
        saveToLocalStorage();
        renderGroups();
        renderItems();
    }

    const content = generateM3U();
    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'playlist.m3u';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function saveCurrentItemFromForm() {
    const itemId = itemIndexInput.value;
    const item = m3uData.find(entry => entry._id === itemId);
    if (!item) return null;

    const oldGroup = getItemGroup(item);
    const oldUrl = item.url || '';
    const newGroup = ensureGroupExists(itemGroupTitleInput.value || selectedGroup || NO_GROUP);

    item.name = itemNameInput.value.trim() || 'Unnamed';
    item.url = itemUrlInput.value.trim();
    if (item.url !== oldUrl) {
        item.status = STATUS_UNKNOWN;
        item.statusDetail = '';
        item.lastChecked = '';
    }
    item.tvgId = itemTvgIdInput.value.trim();
    item.tvgName = itemTvgNameInput.value.trim();
    item.tvgLogo = itemTvgLogoInput.value.trim();
    item.groupTitle = newGroup;
    item.catchup = itemCatchupInput.value.trim();
    item.catchupType = itemCatchupTypeInput.value.trim();
    item.catchupDays = itemCatchupDaysInput.value.trim();
    item.additionalAttributes = buildAdditionalAttributes({ additionalAttributes: itemAdditionalAttrsInput.value.trim() });

    if (oldGroup !== newGroup) {
        selectedGroup = newGroup;
        selectedGroups = new Set([newGroup]);
        groupSelectionAnchor = newGroup;
    }

    selectedChannels = new Set([item._id]);
    activeChannelId = item._id;
    itemSelectionAnchorId = item._id;
    rebuildDataByGroupOrder();
    return item;
}

function saveItemChanges(event) {
    event.preventDefault();

    const item = saveCurrentItemFromForm();
    if (!item) return;

    saveToLocalStorage();
    renderGroups();
    renderItems();
}

function saveToLocalStorage() {
    playlistHeader = (playlistHeaderInput.value || playlistHeader || '#EXTM3U').trim() || '#EXTM3U';
    syncGroupOrder();
    setStorageItem(STORAGE_KEY, JSON.stringify({
        playlistHeader,
        groupOrder,
        m3uData
    }));
    setStorageItem(LEGACY_DATA_KEY, JSON.stringify(m3uData));
    setStorageItem(LEGACY_HEADER_KEY, playlistHeader);
}

function loadFromLocalStorage() {
    const savedProject = getStorageItem(STORAGE_KEY);
    const legacyData = getStorageItem(LEGACY_DATA_KEY);
    const legacyHeader = getStorageItem(LEGACY_HEADER_KEY);

    try {
        if (savedProject) {
            const parsed = JSON.parse(savedProject);
            playlistHeader = parsed.playlistHeader || '#EXTM3U';
            groupOrder = Array.isArray(parsed.groupOrder) ? parsed.groupOrder : [];
            m3uData = Array.isArray(parsed.m3uData) ? parsed.m3uData.map(ensureItem) : [];
        } else if (legacyData) {
            playlistHeader = legacyHeader || '#EXTM3U';
            m3uData = JSON.parse(legacyData).map(ensureItem);
            groupOrder = uniqueList(m3uData.map(getItemGroup));
        }
    } catch (error) {
        console.error('Could not load saved playlist:', error);
        playlistHeader = '#EXTM3U';
        m3uData = [];
        groupOrder = [];
    }

    playlistHeaderInput.value = playlistHeader;
    syncGroupOrder();

    if (groupOrder.length) {
        selectedGroup = groupOrder[0];
        selectedGroups = new Set([selectedGroup]);
        groupSelectionAnchor = selectedGroup;
    }

    renderGroups();
    renderItems();
}

function clearProject() {
    if (!confirm('Are you sure you want to clear this playlist? This cannot be undone.')) return;

    m3uData = [];
    groupOrder = [];
    playlistHeader = '#EXTM3U';
    selectedGroup = null;
    selectedGroups.clear();
    selectedChannels.clear();
    activeChannelId = null;
    renamingGroup = null;
    renamingItemId = null;
    playlistHeaderInput.value = playlistHeader;
    removeStorageItem(STORAGE_KEY);
    removeStorageItem(LEGACY_DATA_KEY);
    removeStorageItem(LEGACY_HEADER_KEY);
    fileInput.value = '';
    renderGroups();
    renderItems();
}

const SortableClass = window.Sortable || function() {};

const groupsSortable = new SortableClass(groupsList, {
    animation: 150,
    onStart(evt) {
        const group = evt.item.dataset.groupName;
        if (!selectedGroups.has(group)) {
            selectedGroups = new Set([group]);
            selectedGroup = group;
            groupSelectionAnchor = group;
            selectedChannels.clear();
            activeChannelId = null;
        }
        evt.item.classList.add('dragging-selected');
    },
    onEnd(evt) {
        evt.item.classList.remove('dragging-selected');
        updateGroupsOrder(evt);
    },
    onChoose() {
        if (window.getSelection) window.getSelection().removeAllRanges();
    }
});

const itemsSortable = new SortableClass(itemsList, {
    animation: 150,
    onStart(evt) {
        const itemId = evt.item.dataset.itemId;
        if (!selectedChannels.has(itemId)) {
            selectedChannels = new Set([itemId]);
            activeChannelId = itemId;
            itemSelectionAnchorId = itemId;
        }
        evt.item.classList.add('dragging-selected');
    },
    onEnd(evt) {
        evt.item.classList.remove('dragging-selected');
        updateItemsOrder(evt);
    },
    onChoose() {
        if (window.getSelection) window.getSelection().removeAllRanges();
    }
});

fileInput.addEventListener('change', handleFileUpload);
downloadBtn.addEventListener('click', downloadM3U);
clearBtn.addEventListener('click', clearProject);
playlistHeaderInput.addEventListener('input', () => {
    playlistHeader = playlistHeaderInput.value.trim() || '#EXTM3U';
    saveToLocalStorage();
});

groupsFilterInput.addEventListener('input', event => {
    groupsFilterValue = event.target.value.toLowerCase();
    renderGroups();
});

itemsFilterInput.addEventListener('input', event => {
    itemsFilterValue = event.target.value.toLowerCase();
    selectedChannels.clear();
    activeChannelId = null;
    renderItems();
});

newGroupBtn.addEventListener('click', createNewGroup);
renameGroupBtn.addEventListener('click', startSelectedGroupRename);
sortGroupsBtn.addEventListener('click', sortGroupsAlphabetically);
deleteGroupsBtn.addEventListener('click', deleteSelectedGroups);

newItemBtn.addEventListener('click', createNewItem);
renameItemBtn.addEventListener('click', startSelectedItemRename);
cloneItemBtn.addEventListener('click', cloneSelectedItem);
if (sortItemsAzBtn) sortItemsAzBtn.addEventListener('click', event => {
    event.preventDefault();
    sortItemsAlphabetically();
});
if (sortItemsStatusBtn) sortItemsStatusBtn.addEventListener('click', event => {
    event.preventDefault();
    sortItemsByStatus();
});
checkItemsBtn.addEventListener('click', checkChannels);
if (checkCurrentItemBtn) checkCurrentItemBtn.addEventListener('click', checkCurrentItem);
deleteItemsBtn.addEventListener('click', deleteSelectedItems);
itemDetailsForm.addEventListener('submit', saveItemChanges);

itemUrlInput.addEventListener('input', event => updateItemUrlPreview(event.target.value));
itemUrlPreview.addEventListener('click', event => {
    if (!itemUrlInput.value) event.preventDefault();
});

loadFromLocalStorage();
