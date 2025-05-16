import React from 'react'

const TermsOfServicePage = () => {
    return (
        <iframe
            src='/pdfs/lemona-terms-of-service.pdf'
            title="Full Page PDF"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
            }}
        />
    )
}

export default TermsOfServicePage