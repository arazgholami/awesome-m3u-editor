<?php

$upstreamUrl = 'remote.m3u';
$localFile = 'local-free.m3u';

function parseM3U($content) {
    $lines = explode("\n", trim($content));
    $channels = [];
    $currentChannel = null;

    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '#EXTINF:') === 0) {
            $currentChannel = $line;
        } elseif (!empty($line) && $line[0] !== '#' && $currentChannel) {
            $channels[] = [
                'extinf' => $currentChannel,
                'url' => $line
            ];
            $currentChannel = null;
        }
    }

    return $channels;
}

function groupChannels($channels) {
    $groups = [];

    foreach ($channels as $channel) {
        preg_match('/group-title="([^"]*)"/', $channel['extinf'], $matches);
        $groupTitle = $matches[1] ?? 'Unknown';

        if (!isset($groups[$groupTitle])) {
            $groups[$groupTitle] = [];
        }

        $groups[$groupTitle][] = $channel;
    }

    return $groups;
}

function getChannelId($extinf) {
    preg_match('/tvg-id="([^"]*)"/', $extinf, $matches);
    return $matches[1] ?? '';
}

$upstreamContent = file_get_contents($upstreamUrl);
$localContent = file_get_contents($localFile);

if (!$upstreamContent || !$localContent) {
    die("Failed to read files\n");
}

$upstreamChannels = parseM3U($upstreamContent);
$localChannels = parseM3U($localContent);

$upstreamGroups = groupChannels($upstreamChannels);
$localGroups = groupChannels($localChannels);

$mergedChannels = [];
$addedCounts = [];

foreach ($localGroups as $groupName => $localGroupChannels) {
    $mergedChannels = array_merge($mergedChannels, $localGroupChannels);

    if (isset($upstreamGroups[$groupName])) {
        $localIds = [];
        foreach ($localGroupChannels as $channel) {
            $localIds[] = getChannelId($channel['extinf']);
        }

        $addedCount = 0;
        foreach ($upstreamGroups[$groupName] as $upstreamChannel) {
            $upstreamId = getChannelId($upstreamChannel['extinf']);
            if (!in_array($upstreamId, $localIds)) {
                $mergedChannels[] = $upstreamChannel;
                $addedCount++;
            }
        }

        if ($addedCount > 0) {
            $addedCounts[$groupName] = $addedCount;
        }
    }
}

$outputContent = "#EXTM3U\n";
foreach ($mergedChannels as $channel) {
    $outputContent .= $channel['extinf'] . "\n" . $channel['url'] . "\n";
}

$timestamp = date('Y-m-d_H-i-s');
$outputFile = "merged_$timestamp.m3u";
file_put_contents($outputFile, $outputContent);

echo "Synced M3U saved as: $outputFile\n";
foreach ($addedCounts as $group => $count) {
    echo "Added $count items to group: $group\n";
}

?>
