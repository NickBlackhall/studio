import { render, screen } from '../../helpers/test-utils'
import MainMenu from '@/components/MainMenu'

describe('MainMenu', () => {
  const mockProps = {
    onCreateRoom: jest.fn(),
    onJoinByCode: jest.fn(),
    onBrowseRooms: jest.fn(),
    onQuickJoin: jest.fn(),
  };

  it('renders without crashing', () => {
    render(<MainMenu {...mockProps} />)
    // Just verify the component renders - look for the background image
    expect(screen.getByAltText('Main Menu background')).toBeInTheDocument()
  })
})