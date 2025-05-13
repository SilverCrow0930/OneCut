import React, { useState } from 'react'

interface AssetType {
    id: string;
    label: string;
}

const tabs: AssetType[] = [
    { id: 'image', label: 'Image' },
    { id: 'video', label: 'Video' },
    // { id: 'music', label: 'Music' },
];

const AssetsToolPanel = () => {

    const [selectedTab, setSelectedTab] = useState<string>('image');

    // Handle tab change
    const handleChange = (tabId: string) => {
        setSelectedTab(tabId);
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            {/*  */}
        </div>
    );
}

export default AssetsToolPanel