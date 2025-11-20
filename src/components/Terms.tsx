import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';

interface TermsProps {
  onBack: () => void;
}

export const Terms: React.FC<TermsProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-screen bg-primary text-mainText">
      <div className="p-4 bg-surface flex items-center gap-4 shadow-md z-10 border-b border-borderColor">
        <button onClick={onBack} className="p-2 -ml-2 text-mutedText hover:text-mainText">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold">Terms of Service</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6 text-mutedText">
          
          <div className="flex items-center gap-3 mb-6 text-mainText">
            <div className="p-3 bg-accent/10 rounded-lg">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Terms & Conditions</h1>
              <p className="text-sm text-mutedText">Last Updated: October 24, 2025</p>
            </div>
          </div>

          <p className="italic text-sm border-l-4 border-accent pl-4 bg-surface p-2 rounded-r">
            Note: This is a placeholder document for internal testing purposes only.
          </p>

          <section>
            <h3 className="text-lg font-bold text-mainText mb-2">1. Introduction</h3>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-mainText mb-2">2. Use of Service</h3>
            <p>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.</li>
              <li>Consectetur, adipisci velit, sed quia non numquam eius modi tempora.</li>
              <li>Incidunt ut labore et dolore magnam aliquam quaerat voluptatem.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-mainText mb-2">3. Privacy Policy</h3>
            <p>
              At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-mainText mb-2">4. Limitations</h3>
            <p>
              Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.
            </p>
          </section>

          <div className="pt-8 border-t border-borderColor text-center text-sm">
            <p>End of Document</p>
          </div>
        </div>
      </div>
    </div>
  );
};