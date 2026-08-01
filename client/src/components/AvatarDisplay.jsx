import React from 'react';

const AvatarDisplay = ({ avatar, imgClass = 'w-8 h-8', textClass = 'text-2xl' }) => {
    if (!avatar) return <span className={textClass}>🛡️</span>;
    
    if (avatar.startsWith('http') || avatar.startsWith('data:image')) {
        return (
            <img 
                src={avatar} 
                alt="avatar" 
                className={`${imgClass} rounded-full object-cover shrink-0 shadow-sm border border-white/20`} 
            />
        );
    }
    
    return <span className={textClass}>{avatar}</span>;
};

export default AvatarDisplay;
